import * as vscode from 'vscode';
import path from 'node:path';
import { RuntimeClient } from '../../../packages/runtime/src/client.js';
import { capture } from './capture.js';
let client: RuntimeClient | undefined;
let busy = false;
export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('oAX (Mock)');
  context.subscriptions.push(output, {
    dispose: () => {
      client?.dispose();
      client = undefined;
    },
  });
  context.subscriptions.push(
    vscode.commands.registerCommand('oax.explainSelection', async () => {
      if (!vscode.workspace.isTrusted)
        throw new Error('oAX requires a trusted workspace');
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.selection.isEmpty) {
        void vscode.window.showInformationMessage(
          'Select code in a saved workspace file first.',
        );
        return;
      }
      const folder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
      if (!folder || editor.document.uri.scheme !== 'file')
        throw new Error('Select a local workspace document');
      const position = (p: vscode.Position) => ({
        line: p.line,
        column: p.character,
      });
      const range = (r: vscode.Range) => ({
        start: position(r.start),
        end: position(r.end),
      });
      const observation = capture(folder.uri.fsPath, {
        fileName: editor.document.fileName,
        uri: editor.document.uri.toString(),
        version: editor.document.version,
        dirty: editor.document.isDirty,
        text: editor.document.getText(),
        cursor: position(editor.selection.active),
        selection: range(editor.selection),
        visibleRanges: editor.visibleRanges.map(range),
        openFiles: vscode.workspace.textDocuments
          .filter(
            (d) =>
              d.uri.scheme === 'file' &&
              vscode.workspace.getWorkspaceFolder(d.uri)?.uri.toString() ===
                folder.uri.toString(),
          )
          .map((d) => d.fileName),
      });
      if (busy) throw new Error('oAX is already explaining a selection');
      busy = true;
      return vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'oAX: Explain Selection (Mock)',
          cancellable: true,
        },
        async (_progress, cancellation) => {
          const controller = new AbortController();
          const subscription = cancellation.onCancellationRequested(() =>
            controller.abort(),
          );
          try {
            // Each command owns a private runtime; no cross-workspace or stale-session reuse.
            client = await RuntimeClient.connect(
              path.join(context.extensionPath, 'dist', 'runtime.cjs'),
              folder.uri.fsPath,
            );
            const { sessionId } = (await client.call('session.open', {})) as {
              sessionId: string;
            };
            const answer = await client.explain(
              sessionId,
              observation,
              'Explain this selection',
              controller.signal,
            );
            output.clear();
            output.append(answer);
            output.show(true);
            await client.call('session.close', {}, sessionId);
            return answer;
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'oAX failed';
            void vscode.window.showErrorMessage(message);
            throw error;
          } finally {
            subscription.dispose();
            client?.dispose();
            client = undefined;
            busy = false;
          }
        },
      );
    }),
  );
}
export function deactivate(): void {
  client?.dispose();
  client = undefined;
}
