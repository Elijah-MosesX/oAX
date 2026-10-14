import * as vscode from 'vscode';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import type { activate } from '../../adapters/vscode/src/extension.js';
import type { MemoryRecord } from '../../packages/runtime/src/memory.js';

/** Opt-in synthetic acceptance; all decisions use actual production picker commands. */
export async function runMemoryLive(): Promise<void> {
  assert.equal(process.env.OAX_AUTOMATED_LIVE_EDITOR_TEST, '1');
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  assert.ok(root && path.basename(root).startsWith('m4-live-'));
  const extension =
    vscode.extensions.getExtension<ReturnType<typeof activate>>(
      'oax-dev.oax-vscode',
    )!;
  await extension.activate();
  const api = extension.exports;
  const document = await vscode.workspace.openTextDocument(
    path.join(root, 'example.mjs'),
  );
  const editor = await vscode.window.showTextDocument(document);
  editor.selection = new vscode.Selection(
    0,
    0,
    0,
    document.lineAt(0).text.length,
  );
  const selection = editor.selection;
  const original = document.getText();
  async function wait(check: () => boolean) {
    const deadline = Date.now() + 70000;
    while (!check()) {
      if (Date.now() > deadline)
        throw new Error(
          `Timed out waiting for editor memory interaction: ${JSON.stringify({ picker: api.inspectMemoryPicker(), prompt: api.inspectInteraction() })}`,
        );
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  async function decide(title: string, approve: boolean) {
    await wait(() => api.inspectInteraction()?.title === title);
    assert.equal(api.inspectInteraction()?.activeLabel, 'Cancel');
    assert.equal(api.inspectBuddy().prompt?.title, title);
    if (approve) {
      await vscode.commands.executeCommand(
        'workbench.action.quickOpenSelectNext',
      );
      assert.notEqual(api.inspectInteraction()?.activeLabel, 'Cancel');
      await vscode.commands.executeCommand(
        'workbench.action.acceptSelectedQuickOpenItem',
      );
    } else
      await vscode.commands.executeCommand('workbench.action.closeQuickOpen');
  }
  const records: MemoryRecord[] = [];
  for (const note of [
    'ORCHID-27: This synthetic subtraction is intentional for a teaching exercise.',
    'UNSELECTED-91: A separate reviewed claim that must not be sent.',
  ]) {
    const saving = vscode.commands.executeCommand<MemoryRecord>(
      'oax.memory.save',
      { note, retentionDays: 1 },
    );
    await decide('Save this reviewed local memory?', true);
    const saved = await saving;
    assert.ok(saved?.id);
    records.push(saved);
  }
  async function audit() {
    const directory = path.join(root!, '.oax', 'audit');
    return (
      await Promise.all(
        (await readdir(directory))
          .filter((name) => name.endsWith('.jsonl'))
          .map(async (name) =>
            (await readFile(path.join(directory, name), 'utf8'))
              .trim()
              .split('\n')
              .filter(Boolean)
              .map(
                (line) =>
                  JSON.parse(line) as {
                    action: { capability: string; taskId: string };
                    outcome: string;
                  },
              ),
          ),
      )
    ).flat();
  }
  async function explain(select: boolean, transmit: boolean) {
    await vscode.window.showTextDocument(document);
    const running = Promise.resolve(
      vscode.commands.executeCommand<string>('oax.explainWithMemory'),
    );
    // Attach a rejection observer while the real picker is being driven.
    let failure: unknown;
    void running.catch((error: unknown) => {
      failure = error;
    });
    await wait(() => {
      if (failure) throw failure;
      return !!api.inspectMemoryPicker()?.activeId;
    });
    const picker = api.inspectMemoryPicker()!;
    assert.equal(picker.ids.length, 2);
    assert.deepEqual(picker.selectedIds, [], 'No note is preselected');
    if (!select) {
      await vscode.commands.executeCommand('workbench.action.closeQuickOpen');
      assert.equal(await running, undefined);
      return;
    }
    // Navigate the actual picker; read-only inspection cannot select or approve.
    if (api.inspectMemoryPicker()?.activeId !== records[0]!.id) {
      await vscode.commands.executeCommand(
        'workbench.action.quickOpenSelectNext',
      );
      await wait(() => api.inspectMemoryPicker()?.activeId === records[0]!.id);
    }
    await vscode.commands.executeCommand(
      'workbench.action.quickPickManyToggle',
    );
    await wait(() => api.inspectMemoryPicker()?.selectedIds.length === 1);
    assert.deepEqual(api.inspectMemoryPicker()?.selectedIds, [records[0]!.id]);
    await vscode.commands.executeCommand(
      'workbench.action.acceptSelectedQuickOpenItem',
    );
    const title =
      'Send this context to Codex using your existing provider login?';
    await wait(() => api.inspectInteraction()?.title === title);
    assert.ok(api.inspectInteraction()?.detail.includes(records[0]!.id));
    assert.ok(!api.inspectInteraction()?.detail.includes(records[1]!.id));
    await decide(title, transmit);
    return running;
  }
  await explain(false, false);
  await explain(true, false);
  assert.equal(
    (await audit()).filter(
      (item) => item.action.capability === 'provider.context',
    ).length,
    0,
  );
  let cursor: ReturnType<typeof api.inspectSpatial>['cursor'];
  const phases = new Set<string>();
  const observer = setInterval(() => {
    cursor = api.inspectSpatial().cursor ?? cursor;
    for (const session of api.inspectBuddy().sessions)
      if (session.provider === 'Codex') phases.add(session.phase);
  }, 20);
  let answer: string | undefined;
  try {
    answer = await explain(true, true);
  } finally {
    clearInterval(observer);
  }
  assert.match(answer ?? '', /ORCHID-27/);
  assert.ok(
    answer?.includes(records[0]!.id),
    'Explanation cites selected note',
  );
  assert.ok(!answer?.includes('UNSELECTED-91'));
  assert.equal(cursor?.path, 'example.mjs');
  assert.ok(editor.selection.isEqual(selection));
  assert.equal(await readFile(document.uri.fsPath, 'utf8'), original);
  const buddy = api.inspectBuddy();
  assert.ok(
    buddy.sessions.some(
      (session) =>
        session.provider === 'Codex' && session.phase === 'completed',
    ),
  );
  assert.ok(
    phases.has('executing'),
    'Observe live lifecycle before completion',
  );
  assert.equal(buddy.prompt, undefined);
  const journal = await audit();
  const transmission = journal.filter(
    (item) => item.action.capability === 'provider.context',
  );
  assert.equal(
    transmission.filter((item) => item.outcome === 'granted').length,
    1,
  );
  assert.equal(new Set(transmission.map((item) => item.action.taskId)).size, 1);
  // The runtime checks the same grant for every streamed iterator step.
  const allowed = transmission.filter(
    (item) => item.outcome === 'allow',
  ).length;
  assert.ok(allowed > 0);
  assert.equal(
    transmission.filter((item) => item.outcome === 'completed').length,
    allowed,
  );
  assert.ok(
    !transmission.some((item) =>
      ['deny', 'failed', 'refused'].includes(item.outcome),
    ),
  );
  assert.ok(!JSON.stringify(journal).includes('ORCHID-27'));
  await writeFile(
    path.join(root, 'acceptance.json'),
    JSON.stringify(
      {
        workflow: 'memory-explain',
        editorVersion: vscode.version,
        preservedSelection: true,
        memoryVerified: true,
        cancelledWithoutTransmission: true,
        answer,
        selectedId: records[0]!.id,
        excludedId: records[1]!.id,
        cursor,
        phases: [...phases],
        buddy,
        audit: journal,
      },
      null,
      2,
    ),
  );
  await vscode.commands.executeCommand('oax.reconnect');
}
