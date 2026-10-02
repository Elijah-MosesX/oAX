import * as vscode from 'vscode';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { RuntimeClient } from '@oax/runtime/client';
import type { GraphResult, GraphNode } from '@oax/codegraph';
import { capture } from './capture.js';
const connections = new Map<
  string,
  Promise<{ client: RuntimeClient; sessionId: string }>
>();
let busy = false;
function snapshot(editor: vscode.TextEditor) {
  const folder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
  if (
    !vscode.workspace.isTrusted ||
    !folder ||
    editor.document.uri.scheme !== 'file'
  )
    throw new Error('oAX requires a trusted local workspace');
  const point = (p: vscode.Position) => ({ line: p.line, column: p.character });
  const range = (r: vscode.Range) => ({
    start: point(r.start),
    end: point(r.end),
  });
  return {
    root: folder.uri.fsPath,
    observation: capture(folder.uri.fsPath, {
      fileName: editor.document.fileName,
      uri: editor.document.uri.toString(),
      version: editor.document.version,
      dirty: editor.document.isDirty,
      text: editor.document.getText(),
      cursor: point(editor.selection.active),
      selection: range(editor.selection),
      visibleRanges: editor.visibleRanges.map(range),
      openFiles: vscode.workspace.textDocuments
        .filter(
          (d) =>
            d.uri.scheme === 'file' &&
            vscode.workspace.getWorkspaceFolder(d.uri)?.uri.toString() ===
              folder.uri.toString() &&
            !/(?:^|[\\/])(?:\.env[^\\/]*|\.git|\.oax|node_modules)(?:[\\/]|$)/i.test(
              d.fileName,
            ),
        )
        .map((d) => d.fileName),
    }),
  };
}
export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('oAX');
  const previews = new Map<string, string>();
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider('oax-preview', {
      provideTextDocumentContent: (uri) => previews.get(uri.toString()) ?? '',
    }),
    { dispose: () => previews.clear() },
  );
  const status = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
  );
  status.text = '$(search) oAX: ready';
  status.tooltip = 'oAX Buddy status reflects public runtime events';
  status.command = 'oax.explainSelection';
  status.show();
  const decoration = vscode.window.createTextEditorDecorationType({
    border: '1px solid',
    borderColor: new vscode.ThemeColor('editorInfo.foreground'),
    after: {
      contentText: ' oAX investigating',
      color: new vscode.ThemeColor('editorInfo.foreground'),
    },
  });
  let observed: string | undefined, timer: NodeJS.Timeout | undefined;
  const connect = async (root: string, providerExecutable?: string) => {
    const key = `${root}:${providerExecutable ?? 'mock'}`;
    let pending = connections.get(key);
    if (!pending) {
      pending = (async () => {
        const client = await RuntimeClient.connect(
          path.join(context.extensionPath, 'dist', 'runtime.cjs'),
          root,
          process.execPath,
          providerExecutable,
        );
        client.subscribe((event) => {
          if (event.method === 'task.state')
            status.text = `$(hubot) oAX: ${event.payload.state}`;
          if (event.method === 'agent.cursor.changed') {
            for (const editor of vscode.window.visibleTextEditors) {
              if (
                path
                  .relative(root, editor.document.fileName)
                  .split(path.sep)
                  .join('/') !== event.payload.path
              )
                continue;
              if (
                event.payload.documentVersion !== undefined &&
                event.payload.documentVersion !== editor.document.version
              )
                continue;
              const r = event.payload.range;
              if (
                !event.payload.contentHash ||
                createHash('sha256')
                  .update(editor.document.getText())
                  .digest('hex') !== event.payload.contentHash
              )
                continue;
              editor.setDecorations(decoration, [
                new vscode.Range(
                  r.start.line,
                  r.start.column,
                  r.end.line,
                  r.end.column,
                ),
              ]);
            }
          }
        });
        const { sessionId } = (await client.call('session.open', {})) as {
          sessionId: string;
        };
        return { client, sessionId };
      })();
      connections.set(key, pending);
      pending.catch(() => connections.delete(key));
    }
    return pending;
  };
  const observe = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const editor = vscode.window.activeTextEditor;
      if (
        !editor ||
        busy ||
        !vscode.workspace.isTrusted ||
        editor.document.uri.scheme !== 'file'
      )
        return;
      try {
        const captured = snapshot(editor);
        const signature = JSON.stringify({
          path: captured.observation.path,
          version: captured.observation.documentVersion,
          cursor: captured.observation.cursor,
          selection: captured.observation.selection,
          visible: captured.observation.visibleRanges,
        });
        if (observed === signature) return;
        const { client, sessionId } = await connect(captured.root);
        const result = (await client.call(
          'spatial.observe',
          { observation: captured.observation },
          sessionId,
        )) as { focused: GraphNode | null };
        observed = signature;
        status.text = `$(search) oAX: ${result.focused?.name ?? 'ready'}`;
      } catch {
        /* A subsequent explicit command reports actionable errors. */
      }
    }, 250);
  };
  context.subscriptions.push(
    output,
    status,
    decoration,
    vscode.window.onDidChangeActiveTextEditor(observe),
    vscode.window.onDidChangeTextEditorSelection(observe),
    vscode.window.onDidChangeTextEditorVisibleRanges(observe),
    vscode.workspace.onDidChangeTextDocument(() => {
      for (const editor of vscode.window.visibleTextEditors)
        editor.setDecorations(decoration, []);
      observe();
    }),
    {
      dispose: () => {
        clearTimeout(timer);
        deactivate();
      },
    },
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('oax.explainSelection', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.selection.isEmpty) {
        void vscode.window.showInformationMessage(
          'Select code in a saved workspace file first.',
        );
        return;
      }
      if (busy) throw new Error('An oAX task is active');
      const captured = snapshot(editor);
      busy = true;
      try {
        return await vscode.window.withProgress(
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
              const { client, sessionId } = await connect(captured.root);
              const answer = await client.explain(
                sessionId,
                captured.observation,
                'Explain this selection',
                controller.signal,
              );
              output.clear();
              output.append(answer);
              output.show(true);
              return answer;
            } catch (error) {
              void vscode.window.showErrorMessage(
                error instanceof Error ? error.message : 'oAX task failed',
              );
              throw error;
            } finally {
              subscription.dispose();
            }
          },
        );
      } finally {
        busy = false;
        observe();
      }
    }),
  );
  for (const relationship of [
    'callers',
    'imports',
    'implements',
    'tests',
  ] as const)
    context.subscriptions.push(
      vscode.commands.registerCommand(`oax.find.${relationship}`, async () => {
        if (busy) throw new Error('An oAX task is active');
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;
        const captured = snapshot(editor);
        const { client, sessionId } = await connect(captured.root);
        const result = (await client.call(
          'graph.query',
          { observation: captured.observation, relationship },
          sessionId,
        )) as GraphResult;
        output.clear();
        output.appendLine(
          `${relationship} for ${result.node?.name ?? 'unresolved symbol'}`,
        );
        for (const item of result.relationships)
          output.appendLine(
            `${item.node?.path ?? item.edge.evidence.path}:${item.edge.evidence.range.start.line + 1} [${item.edge.resolution}] ${item.node?.name ?? item.edge.evidence.text}`,
          );
        result.limitations.forEach((limit) =>
          output.appendLine(`Limitation: ${limit}`),
        );
        output.show(true);
        return result;
      }),
    );
  context.subscriptions.push(
    vscode.commands.registerCommand('oax.onboardRepository', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) throw new Error('Open a workspace file first');
      if (busy) throw new Error('An oAX task is active');
      const captured = snapshot(editor);
      const { client, sessionId } = await connect(captured.root);
      const report = (await client.call(
        'repository.onboard',
        { observation: captured.observation },
        sessionId,
      )) as import('../../../packages/runtime/src/onboarding.js').OnboardingReport;
      output.clear();
      output.appendLine(
        `Repository walkthrough: ${report.files} supported files and ${report.symbols} symbols.`,
      );
      for (const entry of report.entrypointCandidates)
        output.appendLine(
          `Candidate entrypoint: ${entry.path} [${entry.basis}]`,
        );
      for (const module of report.modules)
        output.appendLine(
          `Module: ${module.path} — ${module.symbols} symbols [${module.hash}]`,
        );
      output.appendLine(
        `Root manifest dependency names: ${report.dependencies.join(', ') || 'unavailable'}`,
      );
      report.tests.forEach((test) =>
        output.appendLine(`Test candidate: ${test.path} [${test.basis}]`),
      );
      report.limitations.forEach((limit) =>
        output.appendLine(`Limitation: ${limit}`),
      );
      if (report.truncated)
        output.appendLine(
          'Walkthrough fields were truncated to their budgets.',
        );
      output.show(true);
      return report;
    }),
    vscode.commands.registerCommand('oax.runNodeTests', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      if (busy) throw new Error('An oAX task is active');
      const captured = snapshot(editor);
      busy = true;
      try {
        const { client, sessionId } = await connect(captured.root);
        const plan = (await client.call(
          'verification.prepare',
          { observation: captured.observation },
          sessionId,
        )) as import('../../../packages/runtime/src/verification.js').CheckPlan;
        const approved = await vscode.window.showInformationMessage(
          'Run this exact Node test command?',
          {
            modal: true,
            detail: `${plan.executable}\n${JSON.stringify(plan.args)}\nWorking directory: ${plan.cwd}\n${plan.disclosure}`,
          },
          'Run tests',
        );
        if (approved !== 'Run tests') return;
        return await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'oAX: Run Node Tests',
            cancellable: true,
          },
          async (_progress, cancellation) => {
            const controller = new AbortController();
            const subscription = cancellation.onCancellationRequested(() =>
              controller.abort(),
            );
            output.clear();
            const observed = client.subscribe((event) => {
              if (event.taskId === plan.id && event.method === 'agent.delta')
                output.append(event.payload.text);
            });
            output.show(true);
            try {
              const result = await client.verify(
                sessionId,
                plan.id,
                plan.hash,
                controller.signal,
              );
              output.appendLine('\nNode tests passed (exit 0).');
              return result;
            } catch (error) {
              output.appendLine(
                error instanceof Error ? error.message : 'Verification failed',
              );
              throw error;
            } finally {
              subscription.dispose();
              observed();
            }
          },
        );
      } finally {
        busy = false;
        observe();
      }
    }),
    vscode.commands.registerCommand('oax.refactorRename', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      if (busy) throw new Error('An oAX task is active');
      const newName = await vscode.window.showInputBox({
        prompt: 'New identifier for the selected symbol',
        ignoreFocusOut: true,
      });
      if (!newName) return;
      const captured = snapshot(editor);
      busy = true;
      try {
        const { client, sessionId } = await connect(captured.root);
        const plan = (await client.call(
          'refactor.prepare',
          { observation: captured.observation, newName },
          sessionId,
        )) as import('../../../packages/runtime/src/refactor.js').RenamePlan;
        for (const change of plan.changes) {
          const document = vscode.workspace.textDocuments.find(
            (document) =>
              path
                .relative(captured.root, document.fileName)
                .split(path.sep)
                .join('/') === change.path,
          );
          if (document?.isDirty)
            throw new Error(`Save ${change.path} before renaming`);
        }
        output.clear();
        output.appendLine(`Rename preview ${plan.hash}`);
        for (const change of plan.changes) {
          output.appendLine(
            `--- ${change.path}\n${change.before}\n+++ ${change.path}\n${change.after}`,
          );
        }
        output.appendLine(plan.verification);
        output.show(true);
        previews.clear();
        const first = plan.changes[0];
        if (first) {
          const before = vscode.Uri.from({
            scheme: 'oax-preview',
            path: `/${plan.id}/before/${first.path}`,
          });
          const after = vscode.Uri.from({
            scheme: 'oax-preview',
            path: `/${plan.id}/after/${first.path}`,
          });
          previews.set(before.toString(), first.before);
          previews.set(after.toString(), first.after);
          await vscode.commands.executeCommand(
            'vscode.diff',
            before,
            after,
            `oAX rename: ${first.path}`,
            { preview: true, preserveFocus: true },
          );
        }
        const approved = await vscode.window.showInformationMessage(
          'Apply the displayed rename preview?',
          {
            modal: true,
            detail: `Writes ${plan.changes.map((change) => change.path).join(', ')}. Baselines are rechecked. ${plan.verification}\nI/O failures can leave partial edits; review the result before committing.`,
          },
          'Apply rename',
        );
        if (approved !== 'Apply rename') return;
        for (const change of plan.changes) {
          const document = vscode.workspace.textDocuments.find(
            (document) =>
              path
                .relative(captured.root, document.fileName)
                .split(path.sep)
                .join('/') === change.path,
          );
          if (document?.isDirty)
            throw new Error(
              `Unsaved changes in ${change.path}; prepare a new preview`,
            );
        }
        const fresh = snapshot(editor);
        const result = await client.call(
          'refactor.apply',
          {
            planId: plan.id,
            approvedHash: plan.hash,
            observation: fresh.observation,
          },
          sessionId,
        );
        output.appendLine(JSON.stringify(result));
        return result;
      } finally {
        busy = false;
        observe();
      }
    }),
    vscode.commands.registerCommand('oax.connectGitHub', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) throw new Error('Open a trusted local workspace file first');
      if (busy) throw new Error('An oAX task is active');
      const captured = snapshot(editor);
      const repository = await vscode.window.showInputBox({
        prompt: 'Select exactly one GitHub repository: owner/name',
        validateInput: (value) =>
          /^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(value)
            ? undefined
            : 'Use owner/name',
      });
      if (!repository) return;
      const key = `github.${createHash('sha256').update(`${captured.root}:${repository}`).digest('hex')}`;
      const saved = await context.secrets.get(key);
      const token =
        saved ??
        (await vscode.window.showInputBox({
          prompt:
            'Fine-grained GitHub token scoped to this repository with metadata and pull-request read access. Token stays outside context/config/logs.',
          password: true,
          ignoreFocusOut: true,
        }));
      if (!token) return;
      const approved = await vscode.window.showInformationMessage(
        `Connect read-only GitHub evidence for ${repository}?`,
        {
          modal: true,
          detail:
            'Allows metadata verification and up to five PR associations per requested commit for this workspace/session for one hour. Only fixed-origin GET requests are exposed. No source upload, posting, push or model transmission. A supplied token may have broader permissions; configure read-only repository scope.',
        },
        'Connect read-only',
      );
      if (approved !== 'Connect read-only') return;
      const { client, sessionId } = await connect(captured.root);
      const result = await client.call(
        'github.connect',
        { repository, accessToken: token, approved: true },
        sessionId,
      );
      if (!saved) {
        const remember = await vscode.window.showQuickPick(
          ['Use for this session', 'Remember in VS Code secret storage'],
          { placeHolder: 'Credential retention' },
        );
        if (remember === 'Remember in VS Code secret storage')
          await context.secrets.store(key, token);
      }
      output.appendLine(`Verified read-only GitHub connection: ${repository}`);
      output.show(true);
      return result;
    }),
    vscode.commands.registerCommand('oax.githubHistory', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) throw new Error('Select saved tracked code first');
      if (busy) throw new Error('An oAX task is active');
      const captured = snapshot(editor);
      const { client, sessionId } = await connect(captured.root);
      const history = (await client.call(
        'history.query',
        { observation: captured.observation },
        sessionId,
      )) as import('@oax/git').HistoryEvidence;
      const commit = history.commits[0]?.sha;
      if (!commit) throw new Error('No local commit evidence for this file');
      const evidence = (await client.call(
        'github.history',
        { commit },
        sessionId,
      )) as import('../../../packages/github/src/index.js').GitHubEvidence;
      output.clear();
      output.appendLine(
        `GitHub evidence: ${evidence.repository} commit ${commit}`,
      );
      for (const pr of evidence.pullRequests)
        output.appendLine(
          `${pr.url}\n${pr.title} [${pr.state}]\n${pr.excerpt}`,
        );
      if (!evidence.pullRequests.length)
        output.appendLine(
          'No associated PRs returned; no historical cause inferred.',
        );
      evidence.limitations.forEach((limit) =>
        output.appendLine(`Limitation: ${limit}`),
      );
      output.show(true);
      return evidence;
    }),
    vscode.commands.registerCommand('oax.disconnectGitHub', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const captured = snapshot(editor);
      const { client, sessionId } = await connect(captured.root);
      await client.call('github.disconnect', {}, sessionId);
      const repository = await vscode.window.showInputBox({
        prompt:
          'Optional: owner/name whose remembered token should also be removed (leave blank to keep it)',
      });
      if (repository)
        await context.secrets.delete(
          `github.${createHash('sha256').update(`${captured.root}:${repository}`).digest('hex')}`,
        );
      output.appendLine('GitHub runtime connection released.');
    }),
    vscode.commands.registerCommand('oax.explainHistory', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const captured = snapshot(editor);
      const { client, sessionId } = await connect(captured.root);
      const evidence = (await client.call(
        'history.query',
        { observation: captured.observation },
        sessionId,
      )) as import('@oax/git').HistoryEvidence;
      output.clear();
      output.appendLine(`Git evidence for ${evidence.path}`);
      evidence.commits.forEach((commit) =>
        output.appendLine(`${commit.sha} ${commit.date} ${commit.subject}`),
      );
      output.appendLine(evidence.blame);
      evidence.limitations.forEach((limit) =>
        output.appendLine(`Limitation: ${limit}`),
      );
      output.show(true);
      return evidence;
    }),
    vscode.commands.registerCommand('oax.explainLive', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.selection.isEmpty)
        throw new Error('Select code in a trusted local workspace first');
      if (busy) throw new Error('An oAX task is active');
      const executable = vscode.workspace
        .getConfiguration('oax')
        .inspect<string>('codexExecutable')?.globalValue;
      if (!executable || !path.isAbsolute(executable))
        throw new Error(
          'Set the absolute Codex 0.159.2 executable path in your user settings: oax.codexExecutable',
        );
      const captured = snapshot(editor);
      busy = true;
      try {
        const { client, sessionId } = await connect(captured.root, executable);
        const objective = 'Explain this selection';
        const preview = (await client.call(
          'context.preview',
          { observation: captured.observation, objective },
          sessionId,
        )) as { context: import('@oax/context').ContextSlice; hash: string };
        const approved = await vscode.window.showInformationMessage(
          'Send this context to Codex using your existing provider login?',
          {
            modal: true,
            detail: `Model usage may apply. Selected ${preview.context.path} at version ${preview.context.documentVersion}${preview.context.dirty ? ' (unsaved buffer)' : ''}; ${preview.context.excerpt.length} selected characters, with caller excerpts from: ${preview.context.related?.map((item) => item.path).join(', ') || 'none'}.\nProvider tools and environment access are disabled.`,
          },
          'Send context',
        );
        if (approved !== 'Send context') return;
        return await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'oAX: Explain Selection (Codex)',
            cancellable: true,
          },
          async (_progress, cancellation) => {
            const controller = new AbortController();
            const subscription = cancellation.onCancellationRequested(() =>
              controller.abort(),
            );
            try {
              const answer = await client.explain(
                sessionId,
                captured.observation,
                objective,
                controller.signal,
                preview.hash,
              );
              output.clear();
              output.append(answer);
              output.show(true);
              return answer;
            } finally {
              subscription.dispose();
            }
          },
        );
      } finally {
        busy = false;
        observe();
      }
    }),
    vscode.commands.registerCommand('oax.reconnect', async () => {
      deactivate();
      observed = undefined;
      observe();
    }),
  );
}
export function deactivate(): void {
  for (const pending of connections.values())
    void pending.then(({ client }) => client.dispose()).catch(() => {});
  connections.clear();
}
