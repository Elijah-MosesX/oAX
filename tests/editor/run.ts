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
  const replacement =
    'export function unsavedMarker() { return 42; }\nexport function caller() { return unsavedMarker(); }';
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
  editor.selection = new vscode.Selection(
    0,
    0,
    0,
    replacement.split('\n')[0]!.length,
  );
  const selected = editor.selection;
  const answer = await vscode.commands.executeCommand<string>(
    'oax.explainSelection',
  );
  assert.ok(answer?.includes('[Mock engine'));
  assert.ok(answer.includes(replacement.split('\n')[0]!));
  assert.ok(answer.includes('(unsaved buffer)'));
  assert.ok(answer.includes(`document version ${document.version}`));
  const relationships =
    await vscode.commands.executeCommand<import('@oax/codegraph').GraphResult>(
      'oax.find.callers',
    );
  assert.equal(relationships?.node?.name, 'unsavedMarker');
  assert.equal(relationships?.relationships[0]?.node?.name, 'caller');
  assert.equal(relationships?.relationships[0]?.edge.resolution, 'semantic');
  assert.ok(
    editor.selection.isEqual(selected),
    'Agent decoration must not move the developer selection',
  );
  await vscode.commands.executeCommand('oax.reconnect');
  const reconnected =
    await vscode.commands.executeCommand<import('@oax/codegraph').GraphResult>(
      'oax.find.callers',
    );
  assert.equal(reconnected?.relationships[0]?.node?.name, 'caller');
  const walkthrough = await vscode.commands.executeCommand<
    import('../../packages/runtime/src/onboarding.js').OnboardingReport
  >('oax.onboardRepository');
  assert.ok(walkthrough && walkthrough.files >= 1);
  assert.ok(
    walkthrough.modules.some(
      (module) => module.path === 'example.ts' && module.symbols >= 2,
    ),
  );
  await vscode.commands.executeCommand(
    'workbench.action.revertAndCloseActiveEditor',
  );
  console.log(
    'Verified VS Code unsaved selection -> runtime -> graph -> mock -> output, semantic caller command, and unchanged developer selection.',
  );
}
