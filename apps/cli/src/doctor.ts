import { realpath, stat } from 'node:fs/promises';
import { VERSION } from '@oax/protocol';
import { EDITOR_METHODS } from './editor-bridge.js';
export async function doctor(root: string) {
  const workspace = await realpath(root);
  if (!(await stat(workspace)).isDirectory())
    throw new Error('Workspace must be a directory');
  return {
    protocol: VERSION,
    node: process.versions.node,
    pinnedNode: '24.19.0',
    compatibleNode: process.versions.node === '24.19.0',
    workspace,
    editorContract: 'editor-read-only.v1',
    editorMethods: EDITOR_METHODS,
    provider: 'Not contacted; use the opt-in provider verification workflow',
    limitations: [
      'Prototype adapters expose no writes, test execution, credentials or live provider transmission.',
    ],
  };
}
