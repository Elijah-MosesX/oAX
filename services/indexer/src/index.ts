import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { CodeGraph, type SourceSnapshot } from '@oax/codegraph';
import { workspacePath } from '@oax/context';
import { OaxError } from '@oax/protocol';
const ignored = new Set([
  '.git',
  '.oax',
  '.codex',
  '.aws',
  '.pnpm-store',
  '.vscode-test',
  'node_modules',
  'dist',
  'build',
  'coverage',
]);
export class Indexer {
  snapshots = new Map<string, SourceSnapshot>();
  exclusions: string[] = [];
  constructor(
    readonly root: string,
    readonly graph: CodeGraph,
  ) {}
  async refresh(
    overlays: SourceSnapshot[] = [],
  ): Promise<{ changed: number; files: number; symbols: number }> {
    const root = await realpath(this.root);
    const sources: SourceSnapshot[] = [];
    const metadataFiles: SourceSnapshot[] = [];
    let bytes = 0;
    let entriesVisited = 0;
    this.exclusions = [];
    const visit = async (directory: string) => {
      for (const entry of (
        await readdir(directory, { withFileTypes: true })
      ).sort((a, b) => a.name.localeCompare(b.name))) {
        if (++entriesVisited > 20000)
          throw new OaxError(
            'INDEX_LIMIT',
            'Index discovery entry limit (20000) exceeded',
          );
        if (
          entry.isSymbolicLink() ||
          ignored.has(entry.name.toLowerCase()) ||
          entry.name.toLowerCase().startsWith('.env')
        ) {
          this.exclusions.push(
            path.relative(root, path.join(directory, entry.name)),
          );
          continue;
        }
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          await visit(absolute);
          continue;
        }
        const projectMetadata =
          entry.name === 'package.json' ||
          /^(?:ts|js)config[^/]*\.json$/.test(entry.name);
        if (
          !entry.isFile() ||
          (!projectMetadata &&
            !/\.(?:tsx?|jsx?|mts|cts|mjs|cjs)$/i.test(entry.name))
        )
          continue;
        if (projectMetadata && metadataFiles.length >= 256)
          throw new OaxError(
            'INDEX_LIMIT',
            'Project metadata limit (256 files) exceeded',
          );
        if (!projectMetadata && sources.length >= 2000)
          throw new OaxError('INDEX_LIMIT', 'Index file limit (2000) exceeded');
        const resource = path
          .relative(root, absolute)
          .split(path.sep)
          .join('/');
        const safe = await workspacePath(root, resource);
        const metadata = await stat(safe);
        if (metadata.size > 131_072) {
          this.exclusions.push(resource);
          continue;
        }
        const text = await readFile(safe, 'utf8');
        if (Buffer.byteLength(text) > 131072) {
          this.exclusions.push(resource);
          continue;
        }
        bytes += Buffer.byteLength(text);
        if (bytes > 8_388_608)
          throw new OaxError(
            'INDEX_LIMIT',
            'Index byte limit (8 MiB) exceeded',
          );
        (projectMetadata ? metadataFiles : sources).push({
          path: resource,
          text,
        });
      }
    };
    await visit(root);
    for (const overlay of overlays) {
      await workspacePath(root, overlay.path);
      if (Buffer.byteLength(overlay.text) > 131_072)
        throw new OaxError(
          'INDEX_LIMIT',
          'Editor snapshot exceeds index file limit',
        );
      const index = sources.findIndex((s) => s.path === overlay.path);
      if (index >= 0) sources[index] = overlay;
      else sources.push(overlay);
    }
    if (
      sources.length > 2000 ||
      [...sources, ...metadataFiles].reduce(
        (total, source) => total + Buffer.byteLength(source.text),
        0,
      ) > 8_388_608
    )
      throw new OaxError('INDEX_LIMIT', 'Editor snapshots exceed index budget');
    const result = this.graph.update(sources, metadataFiles);
    this.snapshots = new Map(sources.map((s) => [s.path, s]));
    return result;
  }
}
