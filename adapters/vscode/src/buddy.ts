import * as vscode from 'vscode';
import path from 'node:path';
import { BuddyStore, buddyLabel, type BuddySession } from '@oax/buddy';

export class BuddyView
  implements vscode.TreeDataProvider<vscode.TreeItem>, vscode.Disposable
{
  private emitter = new vscode.EventEmitter<vscode.TreeItem | undefined>();
  readonly onDidChangeTreeData = this.emitter.event;
  private unsubscribe: () => void;
  private children = new WeakMap<vscode.TreeItem, vscode.TreeItem[]>();
  constructor(readonly store: BuddyStore) {
    this.unsubscribe = store.subscribe(() => this.emitter.fire(undefined));
  }
  getTreeItem(item: vscode.TreeItem): vscode.TreeItem {
    return item;
  }
  getChildren(item?: vscode.TreeItem): vscode.TreeItem[] {
    if (item) return this.children.get(item) ?? [];
    const state = this.store.snapshot();
    const roots: vscode.TreeItem[] = [];
    if (state.prompt) {
      const prompt = new vscode.TreeItem(state.prompt.title);
      prompt.description = 'Input requested';
      prompt.tooltip = `Open the actual prompt to choose: ${state.prompt.action}. Buddy cannot grant approval.`;
      prompt.iconPath = new vscode.ThemeIcon('question');
      prompt.command = {
        command: 'oax.buddy.prompt',
        title: 'Show pending prompt',
      };
      roots.push(prompt);
    }
    for (const session of state.sessions) roots.push(this.session(session));
    if (!state.sessions.length)
      roots.push(
        new vscode.TreeItem('Ready — select code in a trusted workspace'),
      );
    const voice = new vscode.TreeItem(
      'Voice deferred; text controls available',
    );
    voice.tooltip = 'No microphone capture or voice transmission is enabled.';
    roots.push(voice);
    return roots;
  }
  private session(session: BuddySession): vscode.TreeItem {
    const item = new vscode.TreeItem(
      `${session.provider} · ${path.basename(session.root)}`,
      vscode.TreeItemCollapsibleState.Expanded,
    );
    item.description = buddyLabel(session);
    item.tooltip = `${session.root}\nSession ${session.id}\n${buddyLabel(session)}`;
    item.iconPath = new vscode.ThemeIcon(
      session.connected ? 'hubot' : 'debug-disconnect',
    );
    const children: vscode.TreeItem[] = [];
    if (session.taskId) {
      const output = new vscode.TreeItem('Show oAX output');
      output.command = {
        command: 'oax.buddy.results',
        title: 'Show oAX output',
      };
      children.push(output);
    }
    if (session.activity)
      children.push(
        new vscode.TreeItem(
          `${session.activity.kind}: ${session.activity.state}`,
        ),
      );
    if (session.location) {
      const cursor = new vscode.TreeItem(
        `${session.location.path}:${session.location.range.start.line + 1}`,
      );
      cursor.description = 'Observed agent location';
      cursor.tooltip =
        'Snapshot-validated location. Click to reveal; your selection is preserved.';
      cursor.iconPath = new vscode.ThemeIcon('location');
      cursor.command = {
        command: 'oax.buddy.location',
        title: 'Reveal observed agent location',
        arguments: [session.id],
      };
      children.push(cursor);
    }
    if (session.result) {
      const result = new vscode.TreeItem(session.result.label);
      result.description = session.result.verified
        ? 'Last observed review: verified'
        : 'Not verified';
      result.command = { command: 'oax.buddy.results', title: 'Show results' };
      children.push(result);
    }
    children.push(
      new vscode.TreeItem(
        `Runtime session: ${session.connected ? 'connected' : 'disconnected'}`,
      ),
    );
    this.children.set(item, children);
    return item;
  }
  dispose(): void {
    this.unsubscribe();
    this.emitter.dispose();
  }
}
