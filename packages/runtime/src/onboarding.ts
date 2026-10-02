import { readFile } from 'node:fs/promises';
import { workspacePath } from '@oax/context';
import type { CodeGraph } from '@oax/codegraph';
export interface OnboardingReport {
  files: number;
  symbols: number;
  modules: { path: string; hash: string; symbols: number }[];
  entrypointCandidates: { path: string; basis: 'filename heuristic' }[];
  tests: { path: string; basis: 'filename heuristic' }[];
  dependencies: string[];
  resolvedImports: number;
  unresolvedImports: number;
  exclusions: string[];
  truncated: boolean;
  limitations: string[];
}
/** Factual walkthrough data; no guessed purpose or architecture narrative. */
export async function onboarding(
  root: string,
  graph: CodeGraph,
  exclusions: string[],
): Promise<OnboardingReport> {
  const nodes = graph.nodes();
  const files = nodes.filter((node) => node.kind === 'file');
  const edges = graph.edges();
  let dependencies: string[] = [];
  try {
    const file = await workspacePath(root, 'package.json');
    const content = await readFile(file, 'utf8');
    if (Buffer.byteLength(content) <= 131072) {
      const manifest = JSON.parse(content) as {
        dependencies?: Record<string, unknown>;
        devDependencies?: Record<string, unknown>;
      };
      dependencies = [
        ...new Set([
          ...Object.keys(manifest.dependencies ?? {}),
          ...Object.keys(manifest.devDependencies ?? {}),
        ]),
      ].sort();
    }
  } catch {
    /* Missing/unsupported manifest does not become an invented dependency list. */
  }
  const entries = files.filter((file) =>
    /(?:^|\/)(?:main|index|app|server)\.[cm]?[jt]sx?$/.test(file.path),
  );
  const tests = files.filter((file) =>
    /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file.path),
  );
  return {
    files: files.length,
    symbols: nodes.length - files.length,
    modules: files.slice(0, 100).map((file) => ({
      path: file.path,
      hash: file.hash,
      symbols: nodes.filter(
        (node) => node.path === file.path && node.kind !== 'file',
      ).length,
    })),
    entrypointCandidates: entries
      .slice(0, 20)
      .map((file) => ({ path: file.path, basis: 'filename heuristic' })),
    tests: tests
      .slice(0, 20)
      .map((file) => ({ path: file.path, basis: 'filename heuristic' })),
    dependencies: dependencies.slice(0, 100),
    resolvedImports: edges.filter(
      (edge) =>
        edge.relationship === 'imports' && edge.resolution === 'semantic',
    ).length,
    unresolvedImports: edges.filter(
      (edge) =>
        edge.relationship === 'imports' && edge.resolution === 'unresolved',
    ).length,
    exclusions: exclusions.slice(0, 100),
    truncated:
      files.length > 100 ||
      entries.length > 20 ||
      tests.length > 20 ||
      dependencies.length > 100 ||
      exclusions.length > 100,
    limitations: [
      ...graph.limitations,
      'Entrypoint candidates and test files are filename evidence, not proof of execution paths or coverage.',
      'Dependency names come from the root package manifest when available; other ecosystems and nested manifests are not analyzed.',
    ],
  };
}
