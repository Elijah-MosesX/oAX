import { spawn } from 'node:child_process';
import path from 'node:path';
import {
  digest,
  type SourceSnapshot,
  type GraphNode,
  type GraphEdge,
} from '@oax/codegraph';
export interface ParserEvidence {
  nodes: GraphNode[];
  edges: GraphEdge[];
  limitations: string[];
}
type RawNode = {
  name: string;
  kind: GraphNode['kind'];
  start: number;
  end: number;
};
type RawRef = {
  owner: number;
  name: string;
  relationship: 'calls' | 'imports';
  start: number;
  end: number;
};
type RawFile = {
  version: number;
  path: string;
  nodes: RawNode[];
  refs: RawRef[];
  errors: string[];
};
export type ParserConfig = {
  directory?: string;
  python?: string;
  java?: string;
  go?: string;
};
const languages = ['py', 'go', 'java'] as const;
function position(text: string, offset: number) {
  const before = text.slice(0, offset).split('\n');
  return { line: before.length - 1, column: before[before.length - 1]!.length };
}
function frame(source: SourceSnapshot) {
  return (
    Buffer.from(source.path).toString('base64') +
    '\t' +
    Buffer.from(source.text).toString('base64') +
    '\n'
  );
}
async function run(
  executable: string,
  args: string[],
  directory: string,
  input: string,
): Promise<string> {
  if (!path.isAbsolute(executable) || !path.isAbsolute(directory))
    throw new Error('Parser executables and directory must be absolute');
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: directory,
      windowsHide: true,
      shell: false,
      env: {
        ...(process.env.SystemRoot
          ? { SystemRoot: process.env.SystemRoot }
          : {}),
        ...(process.env.TEMP ? { TEMP: process.env.TEMP } : {}),
        ...(process.env.PATH ? { PATH: process.env.PATH } : {}),
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const output: Buffer[] = [];
    let bytes = 0;
    let done = false;
    const finish = (error?: Error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (error) {
        child.kill();
        reject(error);
      } else resolve(Buffer.concat(output).toString('utf8'));
    };
    const timer = setTimeout(
      () => finish(new Error('Parser deadline exceeded')),
      20000,
    );
    child.on('error', (error) => finish(error));
    child.stdout.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 8_388_608) finish(new Error('Parser output budget exceeded'));
      else output.push(chunk);
    });
    child.stderr.on('data', () => {}); // Never copy compiler diagnostics/source or host paths to context.
    child.stdin.on('error', () => finish(new Error('Parser input failed')));
    child.on('close', (code) =>
      finish(code === 0 ? undefined : new Error('Parser process failed')),
    );
    child.stdin.end(input);
  });
}
export class PolyglotParser {
  private cached = new Map<string, { signature: string; files: RawFile[] }>();
  constructor(
    private readonly config: ParserConfig = {
      ...(process.env.OAX_LANGUAGE_WORKERS
        ? { directory: process.env.OAX_LANGUAGE_WORKERS }
        : {}),
      ...(process.env.OAX_PYTHON ? { python: process.env.OAX_PYTHON } : {}),
      ...(process.env.OAX_JAVA ? { java: process.env.OAX_JAVA } : {}),
      ...(process.env.OAX_GO_PARSER ? { go: process.env.OAX_GO_PARSER } : {}),
    },
  ) {}
  async parse(snapshots: SourceSnapshot[]): Promise<ParserEvidence> {
    const evidence: ParserEvidence = { nodes: [], edges: [], limitations: [] };
    for (const language of languages) {
      const files = snapshots.filter((s) => s.path.endsWith('.' + language));
      if (!files.length) continue;
      const executable =
        language === 'py'
          ? this.config.python
          : language === 'java'
            ? this.config.java
            : this.config.go;
      if (!executable || !this.config.directory) {
        evidence.limitations.push(
          `${language} declarations unavailable: configure the explicit local parser toolchain. File snapshots remain available.`,
        );
        continue;
      }
      const signature = files
        .map((f) => f.path + ':' + digest(f.text))
        .join('|');
      let parsed = this.cached.get(language);
      if (parsed?.signature !== signature) {
        const args =
          language === 'py'
            ? ['-I', path.join(this.config.directory, 'python_parser.py')]
            : language === 'java'
              ? ['-Xmx128m', '-cp', this.config.directory, 'OaxJavaParser']
              : [];
        const output = await run(
          executable,
          args,
          this.config.directory,
          files.map(frame).join(''),
        );
        const records = output.trim()
          ? output
              .trim()
              .split('\n')
              .map((line) => JSON.parse(line) as RawFile)
          : [];
        if (records.length !== files.length)
          throw new Error('Parser returned an incomplete snapshot');
        records.forEach((record, i) => {
          const file = files[i]!;
          if (
            record.version !== 1 ||
            record.path !== file.path ||
            !Array.isArray(record.nodes) ||
            !Array.isArray(record.refs) ||
            !Array.isArray(record.errors) ||
            record.nodes.length > 10000 ||
            record.refs.length > 30000 ||
            record.errors.some((e) => typeof e !== 'string' || e.length > 300)
          )
            throw new Error('Invalid parser evidence');
          for (const item of [...record.nodes, ...record.refs])
            if (
              typeof item.name !== 'string' ||
              item.name.length > 1000 ||
              !Number.isInteger(item.start) ||
              !Number.isInteger(item.end) ||
              item.start < 0 ||
              item.start > item.end ||
              item.end > file.text.length
            )
              throw new Error('Invalid parser range');
          for (const node of record.nodes)
            if (
              ![
                'function',
                'method',
                'class',
                'interface',
                'type',
                'variable',
              ].includes(node.kind)
            )
              throw new Error('Invalid parser declaration');
          for (const ref of record.refs)
            if (
              !Number.isInteger(ref.owner) ||
              ref.owner < -1 ||
              ref.owner >= record.nodes.length ||
              !['calls', 'imports'].includes(ref.relationship)
            )
              throw new Error('Invalid parser relationship');
        });
        parsed = { signature, files: records };
        this.cached.set(language, parsed);
      }
      parsed.files.forEach((record, i) => {
        const file = files[i]!,
          hash = digest(file.text),
          fileId = `file:${file.path}`;
        evidence.limitations.push(
          ...record.errors.map((e) => `${file.path}: ${e}`),
        );
        const nodes = record.nodes.map(
          (n, index): GraphNode => ({
            id: `syntax:${file.path}:${index}`,
            path: file.path,
            name: n.name,
            kind: n.kind,
            range: {
              start: position(file.text, n.start),
              end: position(file.text, n.end),
            },
            hash,
          }),
        );
        evidence.nodes.push(...nodes);
        for (const node of nodes)
          evidence.edges.push({
            id: `contains:${node.id}`,
            source: fileId,
            target: node.id,
            relationship: 'contains',
            resolution: 'syntactic',
            evidence: { path: file.path, range: node.range, text: node.name },
          });
        record.refs.forEach((ref, index) => {
          // Name candidates are explicitly heuristic: no type/lexical resolution claim.
          const candidates =
            ref.relationship === 'calls'
              ? nodes.filter(
                  (n) =>
                    n.name === ref.name &&
                    (n.kind === 'function' || n.kind === 'method'),
                )
              : [];
          const target = candidates.length === 1 ? candidates[0]! : null;
          evidence.edges.push({
            id: `syntax-edge:${file.path}:${index}`,
            source: ref.owner < 0 ? fileId : nodes[ref.owner]!.id,
            target: target?.id ?? null,
            relationship: ref.relationship,
            resolution: target ? 'heuristic' : 'unresolved',
            evidence: {
              path: file.path,
              range: {
                start: position(file.text, ref.start),
                end: position(file.text, ref.end),
              },
              text: ref.name,
            },
          });
        });
      });
      evidence.limitations.push(
        `${language}: compiler/AST syntax declarations; file-local unique-name caller candidates are heuristic, not type or lexical resolution. Imports and qualified/ambiguous calls remain unresolved. No cross-language semantic edges or refactoring.`,
      );
    }
    return evidence;
  }
}
