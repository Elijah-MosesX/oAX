import path from 'node:path';
import ts from 'typescript';
export interface ProjectFile {
  path: string;
  text: string;
}
interface Alias {
  pattern: string;
  targets: string[];
  base: string;
}
interface Configuration {
  base?: string;
  aliases: Alias[];
}
const inside = (resource: string) =>
  !path.posix.isAbsolute(resource) &&
  !path.win32.isAbsolute(resource) &&
  !resource.includes('\\') &&
  resource !== '..' &&
  !resource.startsWith('../');
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
/** Resolves only files already captured inside the authorized index. Never reads the filesystem. */
export function projectResolver(
  sources: ReadonlyMap<string, ts.SourceFile>,
  metadata: ProjectFile[],
) {
  const files = new Map(metadata.map((file) => [file.path, file.text]));
  const limitations: string[] = [];
  const parsed = new Map<string, Configuration>();
  const candidate = (base: string) => {
    if (!inside(base)) return undefined;
    for (const name of [
      base,
      base.replace(/\.js$/, '.ts'),
      base.replace(/\.jsx$/, '.tsx'),
      base.replace(/\.mjs$/, '.mts'),
      base.replace(/\.cjs$/, '.cts'),
      ...[
        '.ts',
        '.tsx',
        '.mts',
        '.cts',
        '.js',
        '.jsx',
        '.mjs',
        '.cjs',
        '/index.ts',
        '/index.tsx',
        '/index.js',
        '/index.mjs',
      ].map((ext) => base + ext),
    ])
      if (sources.has(name)) return name;
    return undefined;
  };
  const config = (file: string, trail: string[] = []): Configuration => {
    const cached = parsed.get(file);
    if (cached) return cached;
    if (trail.includes(file) || trail.length >= 8) {
      limitations.push(`Configuration inheritance cycle/depth limit: ${file}.`);
      return { aliases: [] };
    }
    const text = files.get(file);
    if (text === undefined) {
      limitations.push(
        `Configuration extends target unavailable inside the captured workspace: ${file}.`,
      );
      return { aliases: [] };
    }
    const result = ts.parseConfigFileTextToJson(file, text);
    if (result.error || !object(result.config)) {
      limitations.push(
        `Invalid project configuration: ${file}; aliases are unavailable.`,
      );
      return { aliases: [] };
    }
    const data = result.config;
    const directory = path.posix.dirname(file);
    let inherited: Configuration = { aliases: [] };
    if (typeof data.extends === 'string') {
      const target = path.posix.normalize(
        path.posix.join(directory, data.extends),
      );
      if (data.extends.startsWith('.') && inside(target))
        inherited = config(files.has(target) ? target : target + '.json', [
          ...trail,
          file,
        ]);
      else
        limitations.push(
          `External configuration inheritance is unsupported: ${file}.`,
        );
    } else if (data.extends !== undefined)
      limitations.push(`Only one local extends target is supported: ${file}.`);
    const options = object(data.compilerOptions) ? data.compilerOptions : {};
    let base = inherited.base;
    if (typeof options.baseUrl === 'string') {
      const target = path.posix.normalize(
        path.posix.join(directory, options.baseUrl),
      );
      if (
        !path.posix.isAbsolute(options.baseUrl) &&
        !path.win32.isAbsolute(options.baseUrl) &&
        !options.baseUrl.includes('\\') &&
        inside(target)
      )
        base = target;
      else {
        limitations.push(
          `Outside-workspace baseUrl rejected: ${file}; project aliases are unavailable.`,
        );
        const unavailable: Configuration = { aliases: [] };
        parsed.set(file, unavailable);
        return unavailable;
      }
    }
    let aliases = inherited.aliases;
    if (object(options.paths)) {
      aliases = [];
      for (const [pattern, targets] of Object.entries(options.paths)) {
        if (pattern.split('*').length > 2 || !Array.isArray(targets)) continue;
        const valid = targets
          .filter(
            (value): value is string =>
              typeof value === 'string' &&
              value.split('*').length <= 2 &&
              !path.win32.isAbsolute(value) &&
              !path.posix.isAbsolute(value) &&
              !value.includes('\\'),
          )
          .slice(0, 32);
        aliases.push({ pattern, targets: valid, base: base ?? directory });
      }
    }
    const value: Configuration = {
      ...(base !== undefined ? { base } : {}),
      aliases,
    };
    parsed.set(file, value);
    return value;
  };
  // Parse even unused configs so invalid inherited metadata never hides its limitations.
  for (const file of files.keys())
    if (/^(?:ts|js)config[^/]*\.json$/.test(path.posix.basename(file)))
      config(file);
  const packages = new Map<
    string,
    { directory: string; manifest: Record<string, unknown> }[]
  >();
  for (const [file, text] of files) {
    if (path.posix.basename(file) !== 'package.json') continue;
    try {
      const data: unknown = JSON.parse(text);
      if (object(data) && typeof data.name === 'string') {
        const entries = packages.get(data.name) ?? [];
        entries.push({ directory: path.posix.dirname(file), manifest: data });
        packages.set(data.name, entries);
      }
    } catch {
      limitations.push(`Invalid package metadata: ${file}.`);
    }
  }
  const exportTargets = (entry: unknown): string[] => {
    if (typeof entry === 'string') return [entry];
    if (!object(entry)) return [];
    return ['types', 'import', 'default', 'require'].flatMap((condition) =>
      typeof entry[condition] === 'string' ? [entry[condition] as string] : [],
    );
  };
  const resolve = (specifier: string, importer: string): string | undefined => {
    if (specifier.startsWith('.'))
      return candidate(
        path.posix.normalize(
          path.posix.join(path.posix.dirname(importer), specifier),
        ),
      );
    let directory = path.posix.dirname(importer);
    let settings: Configuration | undefined;
    while (true) {
      const nearest = ['tsconfig.json', 'jsconfig.json']
        .map((name) => path.posix.normalize(path.posix.join(directory, name)))
        .find((file) => files.has(file));
      if (nearest) {
        settings = config(nearest);
        break;
      }
      if (directory === '.') break;
      directory = path.posix.dirname(directory);
    }
    for (const alias of [...(settings?.aliases ?? [])].sort(
      (a, b) =>
        b.pattern.split('*')[0]!.length - a.pattern.split('*')[0]!.length,
    )) {
      const [prefix, suffix] = alias.pattern.split('*');
      const wildcard = suffix !== undefined;
      if (
        wildcard
          ? !specifier.startsWith(prefix!) ||
            !specifier.endsWith(suffix!) ||
            specifier.length < prefix!.length + suffix!.length
          : specifier !== alias.pattern
      )
        continue;
      const matched = wildcard
        ? specifier.slice(prefix!.length, specifier.length - suffix!.length)
        : '';
      for (const target of alias.targets) {
        const result = candidate(
          path.posix.normalize(
            path.posix.join(alias.base, target.replace('*', matched)),
          ),
        );
        if (result) return result;
      }
    }
    if (settings?.base) {
      const result = candidate(
        path.posix.normalize(path.posix.join(settings.base, specifier)),
      );
      if (result) return result;
    }
    const parts = specifier.split('/');
    const name = specifier.startsWith('@')
      ? parts.slice(0, 2).join('/')
      : parts[0]!;
    const entries = packages.get(name);
    if (!entries || entries.length !== 1) return undefined;
    const entry = entries[0]!;
    const rest = parts.slice(name.startsWith('@') ? 2 : 1).join('/');
    const key = rest ? './' + rest : '.';
    const exports = entry.manifest.exports;
    let targets =
      object(exports) && Object.keys(exports).some((key) => key.startsWith('.'))
        ? exportTargets(exports[key])
        : key === '.'
          ? exportTargets(exports)
          : [];
    if (exports === undefined && !rest)
      targets = [
        entry.manifest.types,
        entry.manifest.module,
        entry.manifest.main,
      ].filter((value): value is string => typeof value === 'string');
    for (const target of targets) {
      if (!target.startsWith('./') && exports !== undefined) continue;
      const joined = path.posix.normalize(
        path.posix.join(entry.directory, target),
      );
      const prefix = entry.directory === '.' ? '' : entry.directory + '/';
      if (!joined.startsWith(prefix)) continue;
      const result = candidate(joined);
      if (result) return result;
    }
    return undefined;
  };
  return { resolve, limitations: [...new Set(limitations)] };
}
