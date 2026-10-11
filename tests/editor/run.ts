import * as vscode from 'vscode';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { SpatialInspection } from '../../adapters/vscode/src/extension.js';
async function waitForSpatial(
  inspect: () => SpatialInspection,
  predicate: (state: SpatialInspection) => boolean,
): Promise<SpatialInspection> {
  for (let attempt = 0; attempt < 100; attempt++) {
    const state = inspect();
    if (predicate(state)) return state;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(
    'Automatic spatial observation did not reach expected editor state',
  );
}
export async function run(): Promise<void> {
  if (process.env.OAX_LIVE_EDITOR_TEST === '1') {
    await (await import('./live.js')).runLive();
    return;
  }
  const folder = vscode.workspace.workspaceFolders?.[0];
  assert.ok(folder);
  const document = await vscode.workspace.openTextDocument(
    path.join(folder.uri.fsPath, 'example.ts'),
  );
  let editor = await vscode.window.showTextDocument(document);
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
  const answer =
    await vscode.commands.executeCommand<string>('oax.explainMock');
  assert.ok(answer?.includes('[Mock engine'));
  assert.ok(answer.includes(replacement.split('\n')[0]!));
  assert.ok(answer.includes('(unsaved buffer)'));
  assert.ok(answer.includes(`document version ${document.version}`));
  const extension = vscode.extensions.getExtension<{
    inspectSpatial: () => SpatialInspection;
    inspectBuddy: () => import('@oax/buddy').BuddySnapshot;
  }>('oax-dev.oax-vscode');
  assert.ok(extension?.isActive);
  const registered = await vscode.commands.getCommands(true);
  for (const name of [
    'oax.memory.save',
    'oax.memory.list',
    'oax.memory.delete',
    'oax.explainWithMemory',
  ])
    assert.ok(registered.includes(name));
  const memory =
    await vscode.commands.executeCommand<unknown[]>('oax.memory.list');
  assert.ok(
    Array.isArray(memory),
    'Editor must use the actual runtime memory listing',
  );
  await assert.rejects(
    async () => await vscode.commands.executeCommand('oax.memory.save'),
    /Save the file and select/,
  );
  assert.ok(
    editor.selection.isEqual(selected),
    'Memory controls preserve the developer selection',
  );
  const inspect = extension.exports.inspectSpatial;
  const decorated = await waitForSpatial(inspect, (state) => !!state.cursor);
  assert.equal(decorated.cursor!.path, 'example.ts');
  assert.equal(
    decorated.cursor!.contentHash,
    createHash('sha256').update(replacement).digest('hex'),
  );
  assert.deepEqual(decorated.cursor!.range.start, { line: 0, column: 0 });
  const inspectBuddy = extension.exports.inspectBuddy;
  const buddySession = inspectBuddy().sessions.find(
    (session) => session.provider === 'mock',
  );
  assert.ok(buddySession?.connected);
  assert.equal(buddySession.phase, 'completed');
  assert.equal(
    buddySession.location?.contentHash,
    decorated.cursor!.contentHash,
  );
  assert.deepEqual(buddySession.location?.range, decorated.cursor!.range);
  await vscode.commands.executeCommand('oax.buddy.show');
  await vscode.commands.executeCommand('oax.buddy.location', buddySession.id);
  assert.ok(
    editor.selection.isEqual(selected),
    'Revealing Buddy location must preserve developer selection',
  );
  await vscode.commands.executeCommand('oax.buddy.hide');
  const hiddenAnswer =
    await vscode.commands.executeCommand<string>('oax.explainMock');
  assert.ok(
    hiddenAnswer?.includes('[Mock engine'),
    'Hiding Buddy cannot disable the runtime',
  );
  assert.equal(
    inspectBuddy().sessions.find((session) => session.id === buddySession.id)
      ?.phase,
    'completed',
  );
  await vscode.commands.executeCommand('oax.buddy.show');
  await waitForSpatial(
    inspect,
    (state) => state.spatial?.observation.documentVersion === document.version,
  );
  editor.selection = new vscode.Selection(1, 17, 1, 17);
  const moved = await waitForSpatial(
    inspect,
    (state) => state.spatial?.focused?.name === 'caller',
  );
  assert.deepEqual(moved.spatial!.observation.cursor, { line: 1, column: 17 });
  assert.equal(moved.spatial!.observation.dirty, true);
  assert.deepEqual(
    moved.spatial!.observation.visibleRanges,
    editor.visibleRanges.map((range) => ({
      start: { line: range.start.line, column: range.start.character },
      end: { line: range.end.line, column: range.end.character },
    })),
  );
  assert.ok(!('text' in moved.spatial!.observation));
  const extra = await vscode.workspace.openTextDocument(
    path.join(folder.uri.fsPath, 'second.ts'),
  );
  await vscode.window.showTextDocument(extra, { preview: false });
  editor = await vscode.window.showTextDocument(document);
  await waitForSpatial(
    inspect,
    (state) => !!state.spatial?.observation.openFiles.includes('second.ts'),
  );
  await vscode.window.showTextDocument(extra);
  await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  editor = await vscode.window.showTextDocument(document);
  await waitForSpatial(
    inspect,
    (state) =>
      state.spatial?.observation.path === 'example.ts' &&
      !state.spatial.observation.openFiles.includes('second.ts'),
  );
  editor.selection = selected;
  const changed = new vscode.WorkspaceEdit();
  changed.insert(
    document.uri,
    new vscode.Position(
      document.lineCount - 1,
      document.lineAt(document.lineCount - 1).text.length,
    ),
    '\n// fresher unsaved snapshot',
  );
  assert.equal(await vscode.workspace.applyEdit(changed), true);
  assert.equal(
    inspect().cursor,
    undefined,
    'Changing source must clear the prior agent decoration',
  );
  assert.ok(inspectBuddy().sessions.every((session) => !session.location));
  await waitForSpatial(
    inspect,
    (state) => state.spatial?.observation.documentVersion === document.version,
  );
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
  assert.ok(
    inspectBuddy().sessions.every((session) => session.id !== buddySession.id),
    'Reconnect must discard prior Buddy session state',
  );
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
