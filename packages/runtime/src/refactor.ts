import { open, lstat, readFile } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { constants } from 'node:fs';
import { workspacePath } from '@oax/context';
import { digest } from '@oax/codegraph';
import { OaxError, renamePlanSchema } from '@oax/protocol';
import { PermissionEngine, type Action } from '@oax/permissions';
export interface RenameChange {
  path: string;
  before: string;
  after: string;
  beforeHash: string;
}
export interface RenamePlan {
  id: string;
  hash: string;
  expiresAt: number;
  changes: RenameChange[];
  verification: string;
  state: 'awaiting_approval';
}
export function renamePlan(
  id: string,
  changes: RenameChange[],
  now = Date.now(),
): RenamePlan {
  if (
    !changes.length ||
    changes.length > 20 ||
    changes.reduce(
      (size, change) =>
        size +
        Buffer.byteLength(change.before) +
        Buffer.byteLength(change.after),
      0,
    ) > 100000
  )
    throw new OaxError('REFACTOR_LIMIT', 'Rename preview exceeds limits');
  return renamePlanSchema.parse({
    id,
    hash: digest(JSON.stringify(changes)),
    expiresAt: now + 60000,
    changes,
    state: 'awaiting_approval',
    verification:
      'TypeScript syntax passed and no new checker diagnostics appeared under the limited local-module model. External consumers and workspace tests were not verified.',
  });
}
/** All baselines and grants are checked before the first write; partial I/O failure is reported explicitly. */
export async function applyRename(
  root: string,
  plan: RenamePlan,
  permissions: PermissionEngine,
  scope: Omit<Action, 'capability' | 'resource'>,
): Promise<{ files: string[]; verification: string }> {
  if (plan.expiresAt <= Date.now())
    throw new OaxError(
      'PERMISSION_DENIED',
      'Rename plan expired; prepare a fresh preview',
    );
  const handles: {
    change: RenameChange;
    handle: FileHandle;
    absolute: string;
    dev: number;
    ino: number;
  }[] = [];
  const written: string[] = [];
  try {
    for (const change of plan.changes) {
      const absolute = await workspacePath(root, change.path);
      const metadata = await lstat(absolute);
      if (metadata.isSymbolicLink() || metadata.nlink !== 1)
        throw new OaxError(
          'PATH_DENIED',
          'Rename requires ordinary, singly linked workspace files',
        );
      const handle = await open(
        absolute,
        constants.O_RDWR |
          (process.platform === 'win32' ? 0 : constants.O_NOFOLLOW),
      );
      handles.push({
        change,
        handle,
        absolute,
        dev: metadata.dev,
        ino: metadata.ino,
      });
      const opened = await handle.stat();
      if (
        opened.dev !== metadata.dev ||
        opened.ino !== metadata.ino ||
        digest(await handle.readFile('utf8')) !== change.beforeHash
      )
        throw new OaxError(
          'EDIT_CONFLICT',
          'File changed after the rename preview',
        );
      await permissions.execute(
        { ...scope, capability: 'workspace.write', resource: change.path },
        async () => undefined,
      );
    }
    for (const { change, handle, absolute, dev, ino } of handles) {
      await permissions.execute(
        { ...scope, capability: 'workspace.write', resource: change.path },
        async () => {
          if ((await workspacePath(root, change.path)) !== absolute)
            throw new OaxError('EDIT_CONFLICT', 'File target changed');
          const metadata = await lstat(absolute);
          if (
            metadata.dev !== dev ||
            metadata.ino !== ino ||
            digest(await readFile(absolute, 'utf8')) !== change.beforeHash
          )
            throw new OaxError('EDIT_CONFLICT', 'File changed before write');
          written.push(change.path);
          const buffer = Buffer.from(change.after);
          let offset = 0;
          while (offset < buffer.length) {
            const result = await handle.write(
              buffer,
              offset,
              buffer.length - offset,
              offset,
            );
            if (!result.bytesWritten) throw new Error('Write made no progress');
            offset += result.bytesWritten;
          }
          await handle.truncate(Buffer.byteLength(change.after));
          await handle.sync();
        },
      );
    }
    return { files: written, verification: plan.verification };
  } catch (error) {
    if (written.length)
      throw new OaxError(
        'PARTIAL_EDIT',
        `Rename stopped after writing ${written.join(', ')}. Review the diff; completed edits were not rolled back.`,
      );
    throw error;
  } finally {
    await Promise.all(handles.map((entry) => entry.handle.close()));
  }
}
