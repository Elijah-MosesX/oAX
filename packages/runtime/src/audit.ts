import { randomUUID, createHash } from 'node:crypto';
import { mkdir, realpath, lstat, open } from 'node:fs/promises';
import { writeSync, fsyncSync } from 'node:fs';
import path from 'node:path';
import type { AuditRecord } from '@oax/permissions';
import { OaxError } from '@oax/protocol';

/** Per-process metadata journal; no source, command output, credentials or raw resources. */
export async function openAudit(root: string) {
  const base = await realpath(root);
  let directory = base;
  for (const segment of ['.oax', 'audit']) {
    directory = path.join(directory, segment);
    await mkdir(directory, { mode: 0o700 }).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code !== 'EEXIST') throw error;
      },
    );
    const metadata = await lstat(directory);
    if (
      !metadata.isDirectory() ||
      metadata.isSymbolicLink() ||
      (await realpath(directory)) !== directory
    )
      throw new OaxError(
        'AUDIT_UNAVAILABLE',
        'Audit directory must be an ordinary workspace directory',
      );
  }
  const file = path.join(directory, `${randomUUID()}.jsonl`);
  const handle = await open(file, 'wx', 0o600);
  let sequence = 0;
  let bytes = 0;
  let closed = false;
  return {
    file,
    record(record: AuditRecord): void {
      if (closed)
        throw new OaxError('AUDIT_UNAVAILABLE', 'Audit journal is closed');
      const { resource, ...scope } = record.action;
      const line = Buffer.from(
        JSON.stringify({
          version: '0.1',
          sequence: ++sequence,
          timestamp: record.timestamp,
          action: {
            ...scope,
            resourceHash: createHash('sha256').update(resource).digest('hex'),
          },
          outcome: record.outcome,
          grantId: record.grantId,
          expiresAt: record.expiresAt,
        }) + '\n',
      );
      if (bytes + line.length > 4 * 1024 * 1024)
        throw new OaxError(
          'AUDIT_UNAVAILABLE',
          'Audit session limit reached; reconnect',
        );
      let offset = 0;
      while (offset < line.length) {
        const written = writeSync(
          handle.fd,
          line,
          offset,
          line.length - offset,
        );
        if (!written)
          throw new OaxError(
            'AUDIT_UNAVAILABLE',
            'Audit write made no progress',
          );
        offset += written;
      }
      fsyncSync(handle.fd);
      bytes += line.length;
    },
    async close(): Promise<void> {
      closed = true;
      await handle.close();
    },
  };
}
