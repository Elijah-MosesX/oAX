import * as vscode from 'vscode';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { runLive } from './live.js';
import { runMemoryLive } from './live-memory.js';
/** Separate development-only harness; never bundled into the oAX extension. */
export async function activate(): Promise<void> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root || !path.basename(root).startsWith('m4-live-')) return;
  try {
    if (process.env.OAX_LIVE_EDITOR_MEMORY_TEST === '1') await runMemoryLive();
    else await runLive();
  } catch (error) {
    await writeFile(
      path.join(root, 'failure.json'),
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Acceptance failed',
        buddy: vscode.extensions
          .getExtension<{
            inspectBuddy: () => import('@oax/buddy').BuddySnapshot;
          }>('oax-dev.oax-vscode')
          ?.exports?.inspectBuddy(),
      }),
    );
  } finally {
    await vscode.commands.executeCommand('workbench.action.closeQuickOpen');
    await vscode.commands.executeCommand('workbench.action.closeWindow');
  }
}
