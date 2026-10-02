import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CodeGraph } from '@oax/codegraph';
import { Indexer } from '@oax/indexer';
import { OaxError } from '@oax/protocol';
import { onboarding } from '../../../packages/runtime/src/onboarding.js';
export const defaultConfig = {
  version: '0.1',
  languages: ['typescript', 'javascript'],
} as const;
async function safeState(root: string): Promise<string> {
  const state = path.join(root, '.oax');
  await mkdir(state, { recursive: true });
  const metadata = await lstat(state);
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    (await realpath(state)) !== state
  )
    throw new OaxError(
      'UNSAFE_STATE',
      'Local state must be a real workspace directory',
    );
  return state;
}
async function rejectLink(file: string): Promise<void> {
  try {
    const metadata = await lstat(file);
    if (metadata.isSymbolicLink() || !metadata.isFile())
      throw new OaxError(
        'UNSAFE_STATE',
        'Local state file must be a regular file',
      );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}
function validateConfig(input: unknown): void {
  const config = input as typeof defaultConfig;
  if (
    !config ||
    typeof config !== 'object' ||
    Object.keys(config).sort().join(',') !== 'languages,version' ||
    config.version !== '0.1' ||
    !Array.isArray(config.languages) ||
    config.languages.length !== 2 ||
    config.languages[0] !== 'typescript' ||
    config.languages[1] !== 'javascript'
  )
    throw new OaxError(
      'INVALID_CONFIG',
      'Unsupported .oax/config.json; expected version 0.1 and TypeScript/JavaScript languages',
    );
}
export async function initializeWorkspace(
  directory: string,
): Promise<{ root: string; created: boolean }> {
  const root = await realpath(directory);
  const state = await safeState(root);
  const file = path.join(state, 'config.json');
  await rejectLink(file);
  try {
    await writeFile(file, JSON.stringify(defaultConfig, null, 2) + '\n', {
      flag: 'wx',
    });
    return { root, created: true };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    validateConfig(JSON.parse(await readFile(file, 'utf8')));
    return { root, created: false };
  }
}
export async function analyzeWorkspace(directory: string): Promise<unknown> {
  const root = await realpath(directory);
  const state = path.join(root, '.oax');
  // Analysis does not silently initialize or replace configuration.
  if ((await safeState(root)) !== state)
    throw new OaxError('UNSAFE_STATE', 'Invalid local state');
  const config = path.join(state, 'config.json');
  await rejectLink(config);
  validateConfig(JSON.parse(await readFile(config, 'utf8')));
  const database = path.join(state, 'graph.sqlite');
  await rejectLink(database);
  const graph = new CodeGraph(database);
  try {
    const indexer = new Indexer(root, graph);
    const result = await indexer.refresh();
    return {
      root,
      ...result,
      exclusions: indexer.exclusions,
      limitations: graph.limitations,
      modules: graph
        .nodes()
        .filter((n) => n.kind === 'file')
        .map((n) => ({ path: n.path, hash: n.hash })),
      imports: graph.edges().filter((e) => e.relationship === 'imports'),
      walkthrough: await onboarding(root, graph, indexer.exclusions),
    };
  } finally {
    graph.close();
  }
}
