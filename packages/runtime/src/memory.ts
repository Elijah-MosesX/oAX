import { randomUUID } from 'node:crypto';
import {
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  realpath,
  unlink,
} from 'node:fs/promises';
import path from 'node:path';
import { digest } from '@oax/codegraph';
import { redact, validateObservation, workspacePath } from '@oax/context';
import { OaxError, rangeSchema, z, type Observation } from '@oax/protocol';

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const recordSchema = z.strictObject({
  version: z.literal('0.1'),
  id: z.uuid(),
  workspaceHash: hash,
  path: z.string().min(1).max(4096),
  range: rangeSchema,
  sourceHash: hash,
  note: z.string().min(1).max(2000),
  retentionDays: z.number().int().min(1).max(90),
  reviewedAt: z.number().int(),
  expiresAt: z.number().int(),
  validation: z.literal('human-reviewed-source-linked'),
  trust: z.literal('untrusted'),
});
export type MemoryRecord = z.infer<typeof recordSchema>;
export type MemoryPlan = Awaited<ReturnType<typeof prepareMemory>>;
export async function prepareMemory(
  root: string,
  observation: Observation,
  note: string,
  retentionDays: number,
) {
  await validateObservation(root, observation);
  if (
    observation.dirty ||
    (await readFile(await workspacePath(root, observation.path), 'utf8')) !==
      observation.text
  )
    throw new OaxError(
      'MEMORY_STALE',
      'Save the exact source snapshot before reviewing memory',
    );
  const operation = {
    workspaceHash: digest(await realpath(root)),
    path: observation.path,
    range: observation.selection,
    sourceHash: digest(observation.text),
    note: redact(note).text,
    retentionDays,
    validation: 'human-reviewed-source-linked' as const,
    trust: 'untrusted' as const,
  };
  return {
    id: randomUUID(),
    hash: digest(JSON.stringify(operation)),
    operation,
    expiresAt: Date.now() + 60000,
    disclosure:
      'Stores this reviewed note locally until explicit deletion. Context use expires after the selected retention period and requires matching source plus separate transmission consent. Review does not prove factual truth.',
  };
}
async function directory(
  root: string,
  create: boolean,
): Promise<string | undefined> {
  let current = await realpath(root);
  for (const segment of ['.oax', 'memory']) {
    current = path.join(current, segment);
    if (create)
      await mkdir(current, { mode: 0o700 }).catch(
        (e: NodeJS.ErrnoException) => {
          if (e.code !== 'EEXIST') throw e;
        },
      );
    let info;
    try {
      info = await lstat(current);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw e;
    }
    if (
      !info.isDirectory() ||
      info.isSymbolicLink() ||
      (await realpath(current)) !== current
    )
      throw new OaxError(
        'UNSAFE_STATE',
        'Memory requires ordinary workspace state directories',
      );
  }
  return current;
}
async function load(
  root: string,
  id: string,
): Promise<{ record: MemoryRecord; hash: string; file: string }> {
  if (!z.uuid().safeParse(id).success)
    throw new OaxError('MEMORY_INVALID', 'Invalid memory identity');
  const dir = await directory(root, false);
  if (!dir) throw new OaxError('MEMORY_NOT_FOUND', 'Memory does not exist');
  const file = path.join(dir, `${id}.json`);
  const info = await lstat(file);
  if (
    !info.isFile() ||
    info.isSymbolicLink() ||
    info.nlink !== 1 ||
    info.size > 16000
  )
    throw new OaxError(
      'UNSAFE_STATE',
      'Memory must be a bounded ordinary file',
    );
  const parsed = recordSchema.safeParse(
    JSON.parse(await readFile(file, 'utf8')),
  );
  if (
    !parsed.success ||
    parsed.data.id !== id ||
    parsed.data.workspaceHash !== digest(await realpath(root))
  )
    throw new OaxError(
      'MEMORY_INVALID',
      'Memory does not match its workspace or schema',
    );
  return {
    record: parsed.data,
    hash: digest(JSON.stringify(parsed.data)),
    file,
  };
}
async function locked<T>(root: string, operation: () => Promise<T>) {
  const dir = await directory(root, true);
  const file = path.join(dir!, '.lock');
  const handle = await open(file, 'wx', 0o600).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'EEXIST')
        throw new OaxError(
          'MEMORY_BUSY',
          'Another memory operation or interrupted writer holds the lock; retry or inspect local recovery instructions',
        );
      throw error;
    },
  );
  try {
    return await operation();
  } finally {
    await handle.close();
    await unlink(file);
  }
}
export async function listMemory(root: string) {
  if (!(await directory(root, false))) return [];
  return locked(root, () => listUnlocked(root));
}
async function listUnlocked(root: string) {
  const dir = await directory(root, false);
  if (!dir) return [];
  const names = (await readdir(dir)).filter((n) => n.endsWith('.json')).sort();
  if (names.length > 16)
    throw new OaxError('MEMORY_LIMIT', 'Memory record limit exceeded');
  return Promise.all(
    names.map(async (name) => {
      const { record, hash } = await load(root, name.slice(0, -5));
      let status: 'fresh' | 'stale' | 'expired' = 'stale';
      if (record.expiresAt <= Date.now()) status = 'expired';
      else
        try {
          if (
            digest(
              await readFile(await workspacePath(root, record.path), 'utf8'),
            ) === record.sourceHash
          )
            status = 'fresh';
        } catch {
          /* Missing, excluded or escaped source cannot validate memory. */
        }
      return { ...record, hash, status };
    }),
  );
}
export async function saveMemory(root: string, plan: MemoryPlan) {
  return locked(root, () => saveUnlocked(root, plan));
}
async function saveUnlocked(root: string, plan: MemoryPlan) {
  if (plan.expiresAt <= Date.now())
    throw new OaxError('MEMORY_STALE', 'Review expired');
  if (
    digest(
      await readFile(await workspacePath(root, plan.operation.path), 'utf8'),
    ) !== plan.operation.sourceHash
  )
    throw new OaxError('MEMORY_STALE', 'Source changed since memory review');
  if ((await listUnlocked(root)).length >= 16)
    throw new OaxError(
      'MEMORY_LIMIT',
      'Delete a reviewed record before saving more',
    );
  const now = Date.now();
  const record = recordSchema.parse({
    ...plan.operation,
    id: plan.id,
    version: '0.1',
    reviewedAt: now,
    expiresAt: now + plan.operation.retentionDays * 86400000,
  });
  const dir = await directory(root, true);
  const encoded = JSON.stringify(record);
  if (Buffer.byteLength(encoded) > 12000)
    throw new OaxError('MEMORY_LIMIT', 'Reviewed record exceeds 12,000 bytes');
  const handle = await open(path.join(dir!, `${record.id}.json`), 'wx', 0o600);
  try {
    await handle.writeFile(encoded);
    await handle.sync();
  } finally {
    await handle.close();
  }
  return record;
}
export async function deleteMemory(
  root: string,
  id: string,
  approvedHash: string,
) {
  return locked(root, () => deleteUnlocked(root, id, approvedHash));
}
async function deleteUnlocked(root: string, id: string, approvedHash: string) {
  const current = await load(root, id);
  if (approvedHash !== current.hash)
    throw new OaxError(
      'PERMISSION_DENIED',
      'Inspect and approve the current record before deleting',
    );
  await unlink(current.file);
  return { deleted: id };
}
export async function memoryContext(
  root: string,
  ids: string[],
  observation: Observation,
) {
  const entries = await listMemory(root);
  return ids.map((id) => {
    const item = entries.find((e) => e.id === id);
    if (
      !item ||
      item.status !== 'fresh' ||
      item.path !== observation.path ||
      item.sourceHash !== digest(observation.text)
    )
      throw new OaxError(
        'MEMORY_STALE',
        'Selected memory is missing, expired, stale or belongs to different code',
      );
    return {
      id: item.id,
      path: item.path,
      range: item.range,
      sourceHash: item.sourceHash,
      note: item.note,
      reviewedAt: item.reviewedAt,
      expiresAt: item.expiresAt,
      validation: item.validation,
      trust: item.trust,
    };
  });
}
