import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';
import { projectResolver, type ProjectFile } from './resolution.js';
import type { Position, TextRange } from '@oax/protocol';
export interface SourceSnapshot {
  path: string;
  text: string;
  version?: number;
  dirty?: boolean;
}
export interface GraphNode {
  id: string;
  path: string;
  name: string;
  kind:
    | 'file'
    | 'function'
    | 'method'
    | 'class'
    | 'interface'
    | 'type'
    | 'variable';
  range: TextRange;
  hash: string;
}
export type Relationship =
  | 'contains'
  | 'imports'
  | 'exports'
  | 'reexports'
  | 'calls'
  | 'implements'
  | 'extends'
  | 'tested_by';
export interface GraphEdge {
  id: string;
  source: string;
  target: string | null;
  relationship: Relationship;
  resolution: 'semantic' | 'syntactic' | 'heuristic' | 'unresolved';
  evidence: { path: string; range: TextRange; text: string };
}
export interface GraphResult {
  node: GraphNode | null;
  relationships: { edge: GraphEdge; node: GraphNode | null }[];
  limitations: string[];
}
export const digest = (text: string) =>
  createHash('sha256').update(text).digest('hex');
const supported = /\.(?:tsx?|jsx?|mts|cts|mjs|cjs)$/i;
const fileId = (file: string) => `file:${file}`;
const pos = (source: ts.SourceFile, offset: number): Position => {
  const point = source.getLineAndCharacterOfPosition(offset);
  return { line: point.line, column: point.character };
};
const range = (source: ts.SourceFile, node: ts.Node): TextRange => ({
  start: pos(source, node.getStart(source)),
  end: pos(source, node.getEnd()),
});
function kind(node: ts.Node): GraphNode['kind'] | null {
  if (
    ts.isFunctionDeclaration(node) ||
    ts.isArrowFunction(node) ||
    ts.isFunctionExpression(node)
  )
    return 'function';
  if (ts.isMethodDeclaration(node) || ts.isMethodSignature(node))
    return 'method';
  if (ts.isClassDeclaration(node)) return 'class';
  if (ts.isInterfaceDeclaration(node)) return 'interface';
  if (ts.isTypeAliasDeclaration(node)) return 'type';
  if (ts.isVariableDeclaration(node)) return 'variable';
  return null;
}
export class CodeGraph {
  private db: DatabaseSync;
  private program: ts.Program | undefined;
  private host: ts.CompilerHost | undefined;
  private declarations = new Map<ts.Node, GraphNode>();
  private sources = new Map<string, ts.SourceFile>();
  private signature = '';
  private projectSignature = '';
  private syntaxSnapshots = new Map<string, SourceSnapshot>();
  limitations = [
    'TypeScript/JavaScript indexed local modules, bounded project aliases and workspace package exports; external packages and computed calls may be unresolved.',
    'Test relationships are filename heuristics and are never reported as semantic coverage.',
    'Resolution uses captured workspace files only. Single local config inheritance, baseUrl/paths and exact package export entries are supported; external libraries, project references and wildcard package exports are unavailable. Static declaration targets do not prove runtime dispatch.',
  ];
  constructor(database = ':memory:') {
    this.db = new DatabaseSync(database);
    this.db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=3000;');
    const version = this.db.prepare('PRAGMA user_version').get()?.user_version;
    if (version !== 0 && version !== 1) {
      this.db.close();
      throw new Error('Unsupported graph migration version');
    }
    this.db
      .exec(`BEGIN; CREATE TABLE IF NOT EXISTS files(path TEXT PRIMARY KEY, hash TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS nodes(id TEXT PRIMARY KEY, path TEXT NOT NULL REFERENCES files(path) ON DELETE CASCADE, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS edges(id TEXT PRIMARY KEY, source TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE, target TEXT REFERENCES nodes(id) ON DELETE CASCADE, relationship TEXT NOT NULL, data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS node_path ON nodes(path); CREATE INDEX IF NOT EXISTS edge_source ON edges(source,relationship); CREATE INDEX IF NOT EXISTS edge_target ON edges(target,relationship); PRAGMA user_version=1; COMMIT;`);
  }
  update(
    snapshots: SourceSnapshot[],
    metadata: ProjectFile[] = [],
    syntax: {
      nodes: GraphNode[];
      edges: GraphEdge[];
      limitations: string[];
    } = { nodes: [], edges: [], limitations: [] },
  ): {
    changed: number;
    files: number;
    symbols: number;
  } {
    const files = snapshots
      .filter((s) => supported.test(s.path))
      .sort((a, b) => a.path.localeCompare(b.path));
    const syntaxFiles = snapshots.filter((s) => /\.(py|go|java)$/.test(s.path));
    const allFiles = [...files, ...syntaxFiles];
    const projectSignature = metadata
      .slice()
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((s) => `${s.path}:${digest(s.text)}`)
      .join('|');
    const signature =
      allFiles.map((s) => `${s.path}:${digest(s.text)}`).join('|') +
      '#' +
      projectSignature +
      '#' +
      digest(JSON.stringify(syntax));
    if (signature === this.signature && this.program)
      return {
        changed: 0,
        files: allFiles.length,
        symbols: this.nodes().filter((n) => n.kind !== 'file').length,
      };
    const changed =
      files.filter(
        (s) =>
          !this.sources.has(s.path) ||
          this.sources.get(s.path)?.text !== s.text,
      ).length +
      [...this.sources.keys()].filter((p) => !files.some((s) => s.path === p))
        .length +
      Number(!!this.signature && this.projectSignature !== projectSignature) +
      syntaxFiles.filter(
        (s) => this.syntaxSnapshots.get(s.path)?.text !== s.text,
      ).length +
      [...this.syntaxSnapshots.keys()].filter(
        (p) => !syntaxFiles.some((s) => s.path === p),
      ).length;
    const previous = this.sources;
    const sources = new Map<string, ts.SourceFile>();
    const declarations = new Map<ts.Node, GraphNode>();
    for (const snapshot of files)
      sources.set(
        snapshot.path,
        previous.get(snapshot.path)?.text === snapshot.text
          ? previous.get(snapshot.path)!
          : ts.createSourceFile(
              snapshot.path,
              snapshot.text,
              ts.ScriptTarget.Latest,
              true,
            ),
      );
    const resolver = projectResolver(sources, metadata);
    const resolve = resolver.resolve;
    const limitations = [
      ...this.limitations.slice(0, 3),
      ...resolver.limitations,
    ];
    const host: ts.CompilerHost = {
      getSourceFile: (name) => sources.get(name),
      getDefaultLibFileName: () => '',
      writeFile: () => {},
      getCurrentDirectory: () => '',
      getDirectories: () => [],
      fileExists: (name) => sources.has(name),
      readFile: (name) => sources.get(name)?.text,
      getCanonicalFileName: (name) => name,
      useCaseSensitiveFileNames: () => true,
      getNewLine: () => '\n',
      resolveModuleNames: (names, importer) =>
        names.map((name) => {
          const file = resolve(name, importer);
          return file
            ? {
                resolvedFileName: file,
                extension: file.endsWith('.tsx')
                  ? ts.Extension.Tsx
                  : file.endsWith('.mts')
                    ? ts.Extension.Mts
                    : file.endsWith('.cts')
                      ? ts.Extension.Cts
                      : file.endsWith('.mjs')
                        ? ts.Extension.Mjs
                        : file.endsWith('.cjs')
                          ? ts.Extension.Cjs
                          : file.endsWith('.ts')
                            ? ts.Extension.Ts
                            : ts.Extension.Js,
              }
            : undefined;
        }),
    };
    const program = ts.createProgram(
      files.map((s) => s.path),
      {
        noLib: true,
        allowJs: true,
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
      host,
    );
    const checker = program.getTypeChecker();
    const nodes: GraphNode[] = [],
      edges: GraphEdge[] = [];
    for (const snapshot of files) {
      const source = sources.get(snapshot.path)!;
      const hash = digest(snapshot.text);
      nodes.push({
        id: fileId(snapshot.path),
        path: snapshot.path,
        name: snapshot.path,
        kind: 'file',
        range: { start: { line: 0, column: 0 }, end: pos(source, source.end) },
        hash,
      });
      const visit = (node: ts.Node) => {
        const k = kind(node);
        const named = node as ts.NamedDeclaration;
        if (
          k &&
          named.name &&
          (ts.isIdentifier(named.name) || ts.isStringLiteral(named.name))
        ) {
          const item: GraphNode = {
            id: `symbol:${snapshot.path}:${node.getStart(source)}:${named.name.getText(source)}`,
            path: snapshot.path,
            name: named.name.getText(source),
            kind: k,
            range: range(source, node),
            hash,
          };
          nodes.push(item);
          declarations.set(node, item);
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
    const target = (expression: ts.Node): GraphNode | undefined => {
      const location = ts.isPropertyAccessExpression(expression)
        ? expression.name
        : expression;
      let symbol = checker.getSymbolAtLocation(location);
      if (symbol && symbol.flags & ts.SymbolFlags.Alias)
        symbol = checker.getAliasedSymbol(symbol);
      return symbol?.declarations
        ?.map((d) => declarations.get(d))
        .find(Boolean);
    };
    for (const [file, source] of sources) {
      const add = (
        owner: string,
        destination: string | null,
        relation: Relationship,
        resolution: GraphEdge['resolution'],
        node: ts.Node,
      ) => {
        const evidence = {
          path: file,
          range: range(source, node),
          text: node.getText(source).slice(0, 512),
        };
        edges.push({
          id: digest(
            `${file}:${owner}:${destination}:${relation}:${node.getStart(source)}:${node.end}`,
          ),
          source: owner,
          target: destination,
          relationship: relation,
          resolution,
          evidence,
        });
      };
      const visit = (
        node: ts.Node,
        owner = fileId(file),
        callOwner = owner,
      ) => {
        const declaration = declarations.get(node);
        if (declaration) {
          add(owner, declaration.id, 'contains', 'syntactic', node);
          if (
            ts.getCombinedModifierFlags(node as ts.Declaration) &
            ts.ModifierFlags.Export
          )
            add(fileId(file), declaration.id, 'exports', 'semantic', node);
          owner = declaration.id;
          if (
            ['function', 'method', 'class'].includes(declaration.kind) ||
            (ts.isVariableDeclaration(node) &&
              node.initializer &&
              (ts.isArrowFunction(node.initializer) ||
                ts.isFunctionExpression(node.initializer)))
          )
            callOwner = declaration.id;
        }
        if (ts.isExportDeclaration(node)) {
          if (
            node.moduleSpecifier &&
            ts.isStringLiteral(node.moduleSpecifier)
          ) {
            const resolved = resolve(node.moduleSpecifier.text, file);
            add(
              fileId(file),
              resolved ? fileId(resolved) : null,
              'reexports',
              resolved ? 'semantic' : 'unresolved',
              node.moduleSpecifier,
            );
          }
          if (node.exportClause && ts.isNamedExports(node.exportClause))
            for (const exported of node.exportClause.elements) {
              const resolved = target(exported.name);
              add(
                fileId(file),
                resolved?.id ?? null,
                'exports',
                resolved ? 'semantic' : 'unresolved',
                exported,
              );
            }
        }
        if (ts.isExportAssignment(node)) {
          const resolved = target(node.expression);
          add(
            fileId(file),
            resolved?.id ?? null,
            'exports',
            resolved ? 'semantic' : 'unresolved',
            node.expression,
          );
        }
        if (
          ts.isImportDeclaration(node) &&
          ts.isStringLiteral(node.moduleSpecifier)
        ) {
          const resolved = resolve(node.moduleSpecifier.text, file);
          add(
            fileId(file),
            resolved ? fileId(resolved) : null,
            'imports',
            resolved ? 'semantic' : 'unresolved',
            node.moduleSpecifier,
          );
        }
        if (
          ts.isImportEqualsDeclaration(node) &&
          ts.isExternalModuleReference(node.moduleReference) &&
          node.moduleReference.expression &&
          ts.isStringLiteral(node.moduleReference.expression)
        ) {
          const resolved = resolve(node.moduleReference.expression.text, file);
          add(
            fileId(file),
            resolved ? fileId(resolved) : null,
            'imports',
            resolved ? 'semantic' : 'unresolved',
            node.moduleReference.expression,
          );
        }
        if (
          ts.isCallExpression(node) &&
          node.expression.kind === ts.SyntaxKind.ImportKeyword &&
          node.arguments[0] &&
          ts.isStringLiteral(node.arguments[0])
        ) {
          const resolved = resolve(node.arguments[0].text, file);
          add(
            fileId(file),
            resolved ? fileId(resolved) : null,
            'imports',
            resolved ? 'semantic' : 'unresolved',
            node.arguments[0],
          );
        }
        if (ts.isCallExpression(node)) {
          const resolved = target(node.expression);
          add(
            callOwner,
            resolved?.id ?? null,
            'calls',
            resolved ? 'semantic' : 'unresolved',
            node.expression,
          );
        }
        if (ts.isHeritageClause(node))
          for (const base of node.types) {
            const resolved = target(base.expression);
            add(
              owner,
              resolved?.id ?? null,
              node.token === ts.SyntaxKind.ImplementsKeyword
                ? 'implements'
                : 'extends',
              resolved ? 'semantic' : 'unresolved',
              base,
            );
          }
        ts.forEachChild(node, (child) => visit(child, owner, callOwner));
      };
      visit(source);
      if (/\.(test|spec)\.(?:[cm]?[jt]s|[jt]sx)$/.test(file)) {
        const implementation = file.replace(
          /\.(test|spec)(?=\.(?:[cm]?[jt]s|[jt]sx)$)/,
          '',
        );
        if (sources.has(implementation))
          add(
            fileId(implementation),
            fileId(file),
            'tested_by',
            'heuristic',
            source,
          );
      }
    }
    for (const snapshot of syntaxFiles) {
      const lines = snapshot.text.split('\n');
      nodes.push({
        id: fileId(snapshot.path),
        path: snapshot.path,
        name: snapshot.path,
        kind: 'file',
        hash: digest(snapshot.text),
        range: {
          start: { line: 0, column: 0 },
          end: {
            line: lines.length - 1,
            column: lines[lines.length - 1]!.length,
          },
        },
      });
    }
    nodes.push(...syntax.nodes);
    edges.push(...syntax.edges);
    limitations.push(...syntax.limitations);
    this.db.exec('BEGIN');
    try {
      this.db.exec('DELETE FROM edges');
      const removed = (
        this.db.prepare('SELECT path FROM files').all() as { path: string }[]
      ).filter((row) => !allFiles.some((f) => f.path === row.path));
      for (const row of removed)
        this.db.prepare('DELETE FROM files WHERE path=?').run(row.path);
      for (const snapshot of allFiles) {
        const hash = digest(snapshot.text);
        const old = this.db
          .prepare('SELECT hash FROM files WHERE path=?')
          .get(snapshot.path);
        if (
          old?.hash !== hash ||
          syntaxFiles.some((f) => f.path === snapshot.path)
        ) {
          this.db.prepare('DELETE FROM nodes WHERE path=?').run(snapshot.path);
          this.db
            .prepare(
              'INSERT INTO files VALUES(?,?) ON CONFLICT(path) DO UPDATE SET hash=excluded.hash',
            )
            .run(snapshot.path, hash);
        }
      }
      for (const node of nodes)
        this.db
          .prepare(
            'INSERT INTO nodes VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',
          )
          .run(node.id, node.path, JSON.stringify(node));
      for (const edge of edges)
        this.db
          .prepare('INSERT INTO edges VALUES(?,?,?,?,?)')
          .run(
            edge.id,
            edge.source,
            edge.target,
            edge.relationship,
            JSON.stringify(edge),
          );
      this.db.exec('COMMIT');
      this.sources = sources;
      this.syntaxSnapshots = new Map(syntaxFiles.map((s) => [s.path, s]));
      this.declarations = declarations;
      this.host = host;
      this.program = program;
      this.limitations = limitations;
      this.signature = signature;
      this.projectSignature = projectSignature;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    return {
      changed,
      files: allFiles.length,
      symbols: nodes.filter((n) => n.kind !== 'file').length,
    };
  }
  nodes(): GraphNode[] {
    return (
      this.db.prepare('SELECT data FROM nodes ORDER BY id').all() as {
        data: string;
      }[]
    ).map((row) => JSON.parse(row.data) as GraphNode);
  }
  edges(): GraphEdge[] {
    return (
      this.db.prepare('SELECT data FROM edges ORDER BY id').all() as {
        data: string;
      }[]
    ).map((row) => JSON.parse(row.data) as GraphEdge);
  }
  focused(file: string, position: Position): GraphNode | null {
    const syntax = this.syntaxSnapshots.get(file);
    if (syntax) {
      const lines = syntax.text.split('\n');
      if (
        position.line < 0 ||
        position.column < 0 ||
        position.line >= lines.length ||
        position.column > lines[position.line]!.replace(/\r$/, '').length
      )
        return null;
      const before = (a: Position, b: Position) =>
        a.line < b.line || (a.line === b.line && a.column <= b.column);
      return (
        this.nodes()
          .filter(
            (n) =>
              n.path === file &&
              n.kind !== 'file' &&
              before(n.range.start, position) &&
              before(position, n.range.end) &&
              !(
                position.line === n.range.end.line &&
                position.column === n.range.end.column
              ),
          )
          .sort(
            (a, b) =>
              a.range.end.line -
                a.range.start.line -
                (b.range.end.line - b.range.start.line) ||
              a.range.end.column -
                a.range.start.column -
                (b.range.end.column - b.range.start.column),
          )[0] ??
        this.nodes().find((n) => n.id === fileId(file)) ??
        null
      );
    }
    const source = this.sources.get(file);
    if (
      !source ||
      !this.program ||
      position.line >= source.getLineStarts().length
    )
      return null;
    const start = source.getLineStarts()[position.line]!;
    const end = source.getLineStarts()[position.line + 1] ?? source.text.length;
    if (
      position.column >
      source.text.slice(start, end).replace(/[\r\n]+$/, '').length
    )
      return null;
    const offset = start + position.column;
    let leaf: ts.Node = source;
    const visit = (node: ts.Node) => {
      if (node.getStart(source) <= offset && offset < node.end) {
        leaf = node;
        ts.forEachChild(node, visit);
      }
    };
    visit(source);
    let symbol = this.program.getTypeChecker().getSymbolAtLocation(leaf);
    if (symbol && symbol.flags & ts.SymbolFlags.Alias)
      symbol = this.program.getTypeChecker().getAliasedSymbol(symbol);
    const referenced = symbol?.declarations
      ?.map((d) => this.declarations.get(d))
      .find(Boolean);
    if (referenced) return referenced;
    for (let node: ts.Node | undefined = leaf; node; node = node.parent) {
      const item = this.declarations.get(node);
      if (item) return item;
    }
    return this.nodes().find((n) => n.id === fileId(file)) ?? null;
  }
  related(
    nodeId: string,
    relation: 'callers' | 'imports' | 'implements' | 'tests',
  ): GraphResult {
    const nodes = this.nodes();
    const node = nodes.find((n) => n.id === nodeId) ?? null;
    const edges = this.edges().filter((e) =>
      relation === 'callers'
        ? e.relationship === 'calls' && e.target === nodeId
        : relation === 'imports'
          ? e.relationship === 'imports' &&
            e.target === fileId(node?.path ?? '')
          : relation === 'implements'
            ? e.relationship === 'implements' && e.target === nodeId
            : e.relationship === 'tested_by' &&
              e.source === fileId(node?.path ?? ''),
    );
    return {
      node,
      relationships: edges.slice(0, 100).map((edge) => ({
        edge,
        node:
          nodes.find(
            (n) => n.id === (relation === 'tests' ? edge.target : edge.source),
          ) ?? null,
      })),
      limitations: [
        ...this.limitations,
        ...(edges.length > 100
          ? ['Relationship results truncated to 100 entries.']
          : []),
      ],
    };
  }
  close(): void {
    this.db.close();
  }
  rename(
    file: string,
    position: Position,
    newName: string,
  ): { path: string; before: string; after: string; beforeHash: string }[] {
    if (
      !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(newName) ||
      !this.program ||
      !this.host
    )
      throw new Error('A valid identifier and indexed snapshot are required');
    const source = this.sources.get(file);
    if (!source || position.line >= source.getLineStarts().length)
      throw new Error('Rename location unavailable');
    let offset = source.getLineStarts()[position.line]! + position.column;
    const host: ts.LanguageServiceHost = {
      ...this.host,
      writeFile: () => {},
      getCompilationSettings: () => this.program!.getCompilerOptions(),
      getScriptFileNames: () => [...this.sources.keys()],
      getScriptVersion: (name) => digest(this.sources.get(name)?.text ?? ''),
      getScriptSnapshot: (name) => {
        const text = this.sources.get(name)?.text;
        return text === undefined
          ? undefined
          : ts.ScriptSnapshot.fromString(text);
      },
    };
    const service = ts.createLanguageService(host);
    try {
      let info = service.getRenameInfo(file, offset, {
        allowRenameOfImportPath: false,
      });
      if (!info.canRename) {
        const focused = this.focused(file, position);
        const entry = [...this.declarations].find(
          ([, node]) => node.id === focused?.id,
        );
        const name = entry?.[0] as ts.NamedDeclaration | undefined;
        if (name?.name && focused) {
          file = focused.path;
          offset = name.name.getStart(name.getSourceFile());
          info = service.getRenameInfo(file, offset, {
            allowRenameOfImportPath: false,
          });
        }
      }
      if (!info.canRename) throw new Error('Selected symbol cannot be renamed');
      const locations = service.findRenameLocations(
        file,
        offset,
        false,
        false,
        true,
      );
      if (!locations?.length) throw new Error('No semantic rename locations');
      const grouped = new Map<string, ts.RenameLocation[]>();
      for (const location of locations) {
        const list = grouped.get(location.fileName) ?? [];
        list.push(location);
        grouped.set(location.fileName, list);
      }
      const proposals = [...grouped]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([path, edits]) => {
          const before = this.sources.get(path)?.text;
          if (before === undefined)
            throw new Error('Rename escaped indexed sources');
          let after = before;
          for (const edit of edits.sort(
            (a, b) => b.textSpan.start - a.textSpan.start,
          ))
            after =
              after.slice(0, edit.textSpan.start) +
              (edit.prefixText ?? '') +
              newName +
              (edit.suffixText ?? '') +
              after.slice(edit.textSpan.start + edit.textSpan.length);
          return { path, before, after, beforeHash: digest(before) };
        });
      // Verify syntax over all proposed source snapshots without executing repository code.
      const verification = new CodeGraph();
      try {
        verification.update(
          [...this.sources].map(([path, source]) => ({
            path,
            text:
              proposals.find((change) => change.path === path)?.after ??
              source.text,
          })),
        );
        if (verification.program!.getSyntacticDiagnostics().length)
          throw new Error('Rename would leave syntax errors');
        const key = (diagnostic: ts.Diagnostic) =>
          `${diagnostic.file?.fileName ?? ''}:${diagnostic.code}:${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`;
        const existing = new Map<string, number>();
        for (const diagnostic of this.program!.getSemanticDiagnostics()) {
          const value = key(diagnostic);
          existing.set(value, (existing.get(value) ?? 0) + 1);
        }
        for (const diagnostic of verification.program!.getSemanticDiagnostics()) {
          const value = key(diagnostic);
          const available = existing.get(value) ?? 0;
          if (!available)
            throw new Error(
              'Rename introduces a TypeScript checker diagnostic; choose another name or resolve the conflict',
            );
          existing.set(value, available - 1);
        }
      } finally {
        verification.close();
      }
      return proposals;
    } finally {
      service.dispose();
    }
  }
}
