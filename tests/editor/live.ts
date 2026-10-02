import * as vscode from 'vscode';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import type { inspectReview } from '../../packages/runtime/src/review.js';
type Report = Awaited<ReturnType<typeof inspectReview>>;
async function command<T>(
  name: string,
  titles: string[],
): Promise<T | undefined> {
  const running = Promise.resolve(vscode.commands.executeCommand<T>(name));
  let finished = false;
  let failure: unknown;
  void running.then(
    () => {
      finished = true;
    },
    (error) => {
      failure = error;
      finished = true;
    },
  );
  if (process.env.OAX_AUTOMATED_LIVE_EDITOR_TEST === '1') {
    const extension = vscode.extensions.getExtension<{
      inspectBuddy: () => import('@oax/buddy').BuddySnapshot;
      inspectInteraction: () =>
        | { title: string; activeLabel: string }
        | undefined;
    }>('oax-dev.oax-vscode');
    assert.ok(extension);
    await extension.activate();
    for (const title of titles) {
      const deadline = Date.now() + 70000;
      while (extension.exports.inspectInteraction()?.title !== title) {
        if (finished)
          throw (
            failure ??
            new Error(`Command ended before approval UI for ${title}`)
          );
        if (Date.now() >= deadline)
          throw new Error(`No approval UI for ${title}`);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      assert.equal(
        extension.exports.inspectInteraction()?.activeLabel,
        'Cancel',
        'Approval must default to cancellation',
      );
      assert.equal(
        extension.exports.inspectBuddy().prompt?.title,
        title,
        'Buddy must reflect the actual production prompt',
      );
      await vscode.commands.executeCommand(
        'workbench.action.quickOpenSelectNext',
      );
      assert.notEqual(
        extension.exports.inspectInteraction()?.activeLabel,
        'Cancel',
        'The real approval item must be selected explicitly',
      );
      await vscode.commands.executeCommand(
        'workbench.action.acceptSelectedQuickOpenItem',
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  return running;
}
/** Opt-in: drives production commands. A person or UI automation answers real dialogs. */
export async function runLive(): Promise<void> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  assert.ok(
    root && path.basename(root).startsWith('m4-live-'),
    'Only generated synthetic workspaces are permitted',
  );
  const file = path.join(root, 'example.mjs');
  const original = await readFile(file, 'utf8');
  const document = await vscode.workspace.openTextDocument(file);
  const editor = await vscode.window.showTextDocument(document);
  editor.selection = new vscode.Selection(
    0,
    0,
    0,
    document.lineAt(0).text.length,
  );
  const selection = editor.selection;
  console.log('M4 LIVE: waiting for real Explain context consent');
  const answer = await command<string>('oax.explainSelection', [
    'Send this context to Codex using your existing provider login?',
  ]);
  assert.ok(
    answer && answer.length > 20,
    'Explain requires a real provider response',
  );
  assert.ok(editor.selection.isEqual(selection));
  assert.equal(await readFile(file, 'utf8'), original);
  const extension = vscode.extensions.getExtension<{
    inspectBuddy: () => import('@oax/buddy').BuddySnapshot;
  }>('oax-dev.oax-vscode');
  assert.ok(extension);
  const explained = extension.exports
    .inspectBuddy()
    .sessions.find((session) => session.provider === 'Codex');
  assert.equal(explained?.phase, 'completed');
  assert.equal(
    explained?.result?.verified,
    undefined,
    'Explain completion is not test verification',
  );
  assert.equal(extension.exports.inspectBuddy().prompt, undefined);
  await vscode.window.showTextDocument(document);
  console.log(
    'M4 LIVE: describe the addition fix and approve context, then inspect and approve the diff',
  );
  const result = await command<{ files: string[] }>('oax.refactorSelection', [
    'Choose a refactor objective',
    'Send the displayed context to Codex to propose an edit?',
    'Apply this exact Codex proposal?',
  ]);
  assert.deepEqual(result?.files, ['example.mjs']);
  assert.ok(
    editor.selection.isEqual(selection),
    'Refactor must preserve developer selection',
  );
  const edited = await readFile(file, 'utf8');
  assert.notEqual(edited, original);
  assert.ok(
    edited.endsWith('// unrelated fixture content\n'),
    'Unselected content must be preserved',
  );
  let report =
    await vscode.commands.executeCommand<Report>('oax.reviewLastEdit');
  assert.ok(report?.current && !report.verified);
  assert.equal(
    extension.exports
      .inspectBuddy()
      .sessions.find((session) => session.id === explained?.id)?.result
      ?.verified,
    false,
  );
  assert.equal(report.changes[0]?.before, original);
  assert.equal(report.changes[0]?.after, edited);
  assert.ok(
    vscode.window.tabGroups.all
      .flatMap((group) => group.tabs)
      .some((tab) => tab.input instanceof vscode.TabInputTextDiff),
    'Native diff must be displayed',
  );
  const testDocument = await vscode.workspace.openTextDocument(
    path.join(root, 'example.test.mjs'),
  );
  await vscode.window.showTextDocument(testDocument);
  console.log('M4 LIVE: approve the real Node test command');
  const output = await command<string>('oax.runNodeTests', [
    'Run this exact Node test command?',
  ]);
  assert.match(output ?? '', /pass 1/);
  report = await vscode.commands.executeCommand<Report>('oax.reviewLastEdit');
  assert.ok(
    report?.verified,
    'Review must connect matching edit hashes to passing real tests',
  );
  assert.equal(report.check?.exitCode, 0);
  assert.equal(report.check?.state, 'passed');
  const buddy = extension.exports.inspectBuddy();
  const verifiedBuddy = buddy.sessions.find(
    (session) => session.id === explained?.id,
  );
  assert.equal(verifiedBuddy?.phase, 'completed');
  assert.equal(verifiedBuddy?.result?.verified, true);
  assert.equal(buddy.prompt, undefined);
  assert.ok(
    vscode.workspace.textDocuments.some(
      (doc) =>
        doc.uri.scheme === 'oax-preview' &&
        doc.uri.path.endsWith('/review.json') &&
        doc.getText().includes('"verified": true'),
    ),
    'Inspectable review must display test evidence',
  );
  await writeFile(
    path.join(root, 'acceptance.json'),
    JSON.stringify(
      {
        editorVersion: vscode.version,
        provider: 'live Codex 0.159.2',
        workflow: 'explain-refactor-approve-test-review',
        answer,
        report,
        preservedSelection: true,
        buddy,
      },
      null,
      2,
    ),
  );
  await vscode.commands.executeCommand('oax.reconnect');
  console.log(
    `M4 LIVE PASSED: real Codex explain -> proposal -> native diff approval -> Node tests -> current review on VS Code ${vscode.version}`,
  );
}
