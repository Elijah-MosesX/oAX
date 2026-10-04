import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import { build } from 'esbuild';
import {
  checkAccess,
  mayWrite,
  mayRetract,
  noteInput,
} from '../deployments/team/shared/domain.js';

test('shared-room policy isolates owners, readers, contributors and unrelated repositories', () => {
  const owner = { userId: 'owner', scope: 'openid' };
  const reader = { userId: 'reader', scope: 'openid' };
  const room = { owner: owner.userId, repository: 'team/code', createdAt: '' };
  assert.equal(checkAccess('room', room, owner), 'owner');
  assert.throws(() => checkAccess('room', room, reader));
  assert.throws(() =>
    checkAccess('room', room, reader, {
      roomId: 'other',
      owner: 'owner',
      role: 'contributor',
    }),
  );
  assert.equal(
    checkAccess('room', room, reader, {
      roomId: 'room',
      owner: 'owner',
      role: 'reader',
    }),
    'reader',
  );
  assert.throws(() => mayWrite('reader'));
  assert.throws(() => mayRetract('contributor', 'other', reader));
  assert.throws(() =>
    noteInput({ title: 'a', text: 'b', kind: 'finding', path: '../outside' }),
  );
  assert.throws(() =>
    noteInput({ title: 'a', text: 'x'.repeat(8001), kind: 'finding' }),
  );
});

test('real collaboration handlers enforce revocation, append concurrent notes and send no content over sockets', async () => {
  const bundle = await build({
    entryPoints: ['deployments/team/backend/index.ts'],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    external: ['@appdeploy/sdk'],
    plugins: [
      {
        name: 'canonical-evidence',
        setup(b) {
          b.onResolve({ filter: /^\.\.\/shared\/validate$/ }, () => ({
            path: path.resolve('apps/evidence/src/validate.ts'),
          }));
        },
      },
    ],
  });
  type RecordValue = Record<string, unknown>;
  type User = { userId: string; scope: string; email?: string };
  type Context = {
    user?: User;
    body?: unknown;
    params: Record<string, string>;
    query: Record<string, string>;
  };
  type Response = { statusCode: number; data: RecordValue };
  type Middleware = (
    ctx: Context,
  ) => Promise<Response | undefined> | Response | undefined;
  const tables = new Map<string, Map<string, RecordValue>>();
  const table = (name: string) => {
    if (!tables.has(name)) tables.set(name, new Map());
    return tables.get(name)!;
  };
  let counter = 0;
  const invitations = new Map<
    string,
    {
      actor: User;
      allowList: string[];
      context: RecordValue;
      revoked?: boolean;
    }
  >();
  const messages: unknown[] = [];
  let visualRequests = 0;
  let quotaExceeded = false;
  const sdk = {
    ai: {
      extract: async () => {
        visualRequests++;
        return {
          data: {
            summary: 'Visible error',
            observations: ['A warning is visible'],
            suggestions: ['Read the diagnostic'],
            uncertainty: 'Code location unverified',
          },
        };
      },
    },
    router: (routes: Record<string, Middleware[]>) => routes,
    json: (data: RecordValue, statusCode = 200) => ({ data, statusCode }),
    error: (message: string, statusCode = 400) => ({
      data: { error: message },
      statusCode,
    }),
    requireAuth: () => (ctx: Context) =>
      ctx.user ? undefined : sdk.error('Unauthorized', 401),
    db: {
      add: async (name: string, records: RecordValue[]) =>
        records.map((record) => {
          const id = `id-${++counter}`;
          table(name).set(id, structuredClone(record));
          return id;
        }),
      get: async (name: string, ids: string[]) =>
        ids.map((id) => structuredClone(table(name).get(id) ?? null)),
      list: async (name: string, options: { limit: number }) => {
        if (quotaExceeded)
          throw Object.assign(new Error('quota'), {
            code: 'AppDatabaseQuotaExceeded',
            statusCode: 429,
          });
        return {
          items: [...table(name)]
            .slice(0, options.limit)
            .map(([id, record]) => ({ ...structuredClone(record), id })),
        };
      },
      update: async (
        name: string,
        records: { id: string; record: RecordValue }[],
      ) =>
        records.map(({ id, record }) => {
          if (!table(name).has(id)) return false;
          table(name).set(id, structuredClone(record));
          return true;
        }),
      delete: async (name: string, ids: string[]) =>
        ids.map((id) => table(name).delete(id)),
    },
    invites: {
      create: async (data: {
        actor: User;
        allowList: string[];
        context: RecordValue;
      }) => {
        const code = `invite-${++counter}`;
        invitations.set(code, data);
        return { code };
      },
      join: async ({ code, actor }: { code: string; actor: User }) => {
        const entry = invitations.get(code);
        if (
          !entry ||
          entry.revoked ||
          !entry.allowList.includes(actor.email ?? '')
        )
          throw Object.assign(new Error('denied'), {
            code: 'invite_not_allowed',
          });
        return { resourceType: 'oax_room', context: entry.context };
      },
      revoke: async ({ code, actor }: { code: string; actor: User }) => {
        const entry = invitations.get(code);
        if (entry?.actor.userId !== actor.userId)
          throw Object.assign(new Error('denied'), {
            code: 'invite_not_allowed',
          });
        entry.revoked = true;
        return { ok: true };
      },
    },
    isInviteError: (err: { code?: string }) =>
      err.code === 'invite_not_allowed',
    ws: {
      send: async (_ids: string[], message: unknown) => {
        messages.push(message);
        return { ok: true };
      },
    },
  };
  const module = { exports: {} as { handler: Record<string, Middleware[]> } };
  vm.runInNewContext(bundle.outputFiles[0]!.text, {
    module,
    exports: module.exports,
    require: () => sdk,
    TextEncoder,
    Date,
    AbortSignal,
    Uint8Array,
    TextDecoder,
  });
  const call = async (
    route: string,
    user: User | undefined,
    params: Record<string, string> = {},
    body: RecordValue = {},
  ) => {
    for (const middleware of module.exports.handler[route]!) {
      const result = await middleware({
        ...(user ? { user } : {}),
        params,
        body,
        query: {},
      });
      if (result) return result;
    }
    throw new Error('No response');
  };
  const owner = {
    userId: 'owner',
    email: 'owner@example.test',
    scope: 'openid email',
  };
  const teammate = {
    userId: 'teammate',
    email: 'teammate@example.test',
    scope: 'openid email',
  };
  assert.equal((await call('GET /api/rooms', undefined)).statusCode, 401);
  const created = await call(
    'POST /api/rooms',
    owner,
    {},
    { repository: 'team/code' },
  );
  const id = String(created.data.id);
  assert.equal(
    (
      await call(
        'POST /api/rooms/:id/vision',
        owner,
        { id },
        { image: '/9j/AA==', question: 'Explain' },
      )
    ).statusCode,
    403,
  );
  assert.equal(visualRequests, 0);
  assert.equal(
    (
      await call(
        'POST /api/rooms/:id/vision',
        owner,
        { id },
        { image: '/9j/AA==', question: 'Explain', approved: true },
      )
    ).statusCode,
    200,
  );
  assert.equal(visualRequests, 1);
  assert.equal(table(`entries:${id}`).size, 0);
  const invited = await call(
    'POST /api/rooms/:id/invites',
    owner,
    { id },
    { email: teammate.email, role: 'contributor' },
  );
  const accessCode = String(invited.data.code);
  const savedInvites = await call('POST /api/rooms/:id/invitations', owner, {
    id,
  });
  assert.equal(savedInvites.statusCode, 200);
  assert.equal((savedInvites.data.items as RecordValue[])[0]?.code, accessCode);
  assert.equal(
    (
      await call(
        'POST /api/rooms/:id/invitations',
        teammate,
        { id },
        { accessCode },
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (await call('POST /api/rooms/:id/read', teammate, { id }, {})).statusCode,
    400,
  );
  assert.equal(
    (await call('POST /api/rooms/:id/read', teammate, { id }, { accessCode }))
      .statusCode,
    200,
  );
  await call(
    'POST /api/rooms/:id/subscribe',
    teammate,
    { id },
    { accessCode, connection_id: 'socket' },
  );
  const note = {
    kind: 'finding',
    title: 'Evidence',
    text: 'private-marker',
    path: 'src/file.ts',
  };
  const writes = await Promise.all([
    call('POST /api/rooms/:id/entries', owner, { id }, note),
    call(
      'POST /api/rooms/:id/entries',
      teammate,
      { id },
      { ...note, accessCode },
    ),
  ]);
  assert.ok(writes.every((x) => x.statusCode === 200));
  assert.equal(table(`entries:${id}`).size, 2);
  assert.ok(messages.length > 0);
  assert.ok(!JSON.stringify(messages).includes('private-marker'));
  const other = await call(
    'POST /api/rooms',
    owner,
    {},
    { repository: 'team/other' },
  );
  assert.equal(
    (
      await call(
        'POST /api/rooms/:id/read',
        teammate,
        { id: String(other.data.id) },
        { accessCode },
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await call(
        'POST /api/rooms/:id/entries/:entry/retract',
        teammate,
        { id, entry: String(writes[0]!.data.id) },
        { accessCode },
      )
    ).statusCode,
    403,
  );
  await call('POST /api/invites/:code/revoke', owner, { code: accessCode });
  assert.equal(
    (await call('POST /api/rooms/:id/read', teammate, { id }, { accessCode }))
      .statusCode,
    403,
  );
  assert.equal(
    (
      await call(
        'POST /api/rooms/:id/entries',
        teammate,
        { id },
        { ...note, accessCode },
      )
    ).statusCode,
    403,
  );
  quotaExceeded = true;
  const quota = await call('GET /api/rooms', owner);
  assert.equal(quota.statusCode, 429);
  assert.match(String(quota.data.error), /Wait before refreshing/);
});
