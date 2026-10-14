import * as vscode from 'vscode';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import type { MemoryRecord } from '../../packages/runtime/src/memory.js';

/** Separate test harness: draft arguments never approve an operation. */
export async function memoryApprovals(root: string) {
  const extension = vscode.extensions.getExtension<{
    inspectInteraction: () =>
      | { title: string; activeLabel: string; detail: string }
      | undefined;
    inspectBuddy: () => import('@oax/buddy').BuddySnapshot;
  }>('oax-dev.oax-vscode')!;
  async function act<T>(
    command: string,
    input: unknown,
    title: string,
    approve: boolean,
  ): Promise<T | undefined> {
    const running = Promise.resolve(
      vscode.commands.executeCommand<T>(command, input),
    );
    let finished = false;
    void running.then(
      () => {
        finished = true;
      },
      () => {
        finished = true;
      },
    );
    const deadline = Date.now() + 15000;
    while (extension.exports.inspectInteraction()?.title !== title) {
      if (finished) {
        await running;
        throw new Error(`Command ended before ${title}`);
      }
      if (Date.now() > deadline) throw new Error(`Missing approval: ${title}`);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.equal(extension.exports.inspectInteraction()?.activeLabel, 'Cancel');
    assert.equal(extension.exports.inspectBuddy().prompt?.title, title);
    if (approve) {
      await vscode.commands.executeCommand(
        'workbench.action.quickOpenSelectNext',
      );
      assert.notEqual(
        extension.exports.inspectInteraction()?.activeLabel,
        'Cancel',
      );
      await vscode.commands.executeCommand(
        'workbench.action.acceptSelectedQuickOpenItem',
      );
    } else
      await vscode.commands.executeCommand('workbench.action.closeQuickOpen');
    const result = await running;
    assert.equal(extension.exports.inspectBuddy().prompt, undefined);
    return result;
  }
  const file = path.join(root, `memory-ui-${randomUUID()}.ts`);
  await writeFile(file, 'export function syntheticValue() { return 42; }\n');
  const document = await vscode.workspace.openTextDocument(file);
  const editor = await vscode.window.showTextDocument(document);
  editor.selection = new vscode.Selection(
    0,
    0,
    0,
    document.lineAt(0).text.length,
  );
  const selection = editor.selection;
  const draft = {
    note: 'Synthetic fixture returns forty two.',
    retentionDays: 1,
  };
  const list = () =>
    vscode.commands.executeCommand<MemoryRecord[]>('oax.memory.list');
  try {
    await act(
      'oax.memory.save',
      draft,
      'Save this reviewed local memory?',
      false,
    );
    assert.ok(
      !(await list())!.some((item) => item.path === path.basename(file)),
      'Cancelling must not save',
    );
    const saved = await act<MemoryRecord>(
      'oax.memory.save',
      draft,
      'Save this reviewed local memory?',
      true,
    );
    assert.ok(saved?.id);
    assert.equal(saved.note, draft.note);
    assert.ok(editor.selection.isEqual(selection));
    await vscode.commands.executeCommand('oax.reconnect');
    assert.ok(
      (await list())!.some((item) => item.id === saved.id),
      'Saved note survives runtime reconnect',
    );
    await act(
      'oax.memory.delete',
      { id: saved.id },
      'Delete this local memory record?',
      false,
    );
    assert.ok((await list())!.some((item) => item.id === saved.id));
    await act(
      'oax.memory.delete',
      { id: saved.id },
      'Delete this local memory record?',
      true,
    );
    assert.ok(!(await list())!.some((item) => item.id === saved.id));
    assert.ok(editor.selection.isEqual(selection));
    console.log(
      'MEMORY EDITOR PASSED: actual Cancel-default save/delete dialogs, Buddy prompts, persistence across reconnect and unchanged selection; no model request.',
    );
  } finally {
    await vscode.commands.executeCommand('workbench.action.closeQuickOpen');
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    await unlink(file);
  }
}
