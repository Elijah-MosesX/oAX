import * as vscode from 'vscode';
import assert from 'node:assert/strict';
import path from 'node:path';
export async function run(): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  assert.ok(folder);
  const document = await vscode.workspace.openTextDocument(
    path.join(folder.uri.fsPath, 'example.ts'),
  );
  const editor = await vscode.window.showTextDocument(document);
  const replacement = 'export const unsavedMarker = 42;';
  const edit = new vscode.WorkspaceEdit();
  edit.replace(
    document.uri,
    new vscode.Range(
      0,
      0,
      document.lineCount - 1,
      document.lineAt(document.lineCount - 1).text.length,
    ),
    replacement,
  );
  assert.equal(await vscode.workspace.applyEdit(edit), true);
  editor.selection = new vscode.Selection(0, 0, 0, replacement.length);
  const answer = await vscode.commands.executeCommand<string>(
    'oax.explainSelection',
  );
  assert.ok(answer?.includes('[Mock engine'));
  assert.ok(answer.includes(replacement));
  assert.ok(answer.includes('(unsaved buffer)'));
  assert.ok(answer.includes(`document version ${document.version}`));
  await vscode.commands.executeCommand(
    'workbench.action.revertAndCloseActiveEditor',
  );
  console.log(
    'Verified VS Code selection -> runtime -> mock -> output command, including unsaved buffer.',
  );
}
