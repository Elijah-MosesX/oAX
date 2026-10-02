import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { startWorkbench } from '../../apps/workbench/src/server.js';
import { parseEvidence } from '../../apps/evidence/src/validate.js';
test('workbench authenticates one owner, reuses real runtime graph, rejects external requests and writes', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'oax-workbench-'));
  await writeFile(
    path.join(root, 'sample.ts'),
    'export function add(a: number, b: number) { return a+b; }\nexport const sum = add(1,2);\n',
  );
  const app = await startWorkbench(
    root,
    path.resolve('dist/cli.cjs'),
    path.resolve('apps/workbench/public'),
  );
  const post = (
    route: string,
    body: unknown,
    headers: Record<string, string> = {},
  ) =>
    fetch(app.origin + route, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: app.origin,
        ...headers,
      },
      body: JSON.stringify(body),
    });
  try {
    assert.equal((await post('/rpc', {})).status, 403);
    assert.equal((await post('/resume', {})).status, 403);
    const manifest = await fetch(app.origin + '/manifest.webmanifest');
    assert.match(manifest.headers.get('content-type')!, /manifest/);
    assert.equal((await manifest.json()).start_url, '/');
    assert.equal(
      (
        await post(
          '/connect',
          { token: app.url.split('#')[1] },
          { Origin: 'https://attacker.test' },
        )
      ).status,
      403,
    );
    const connected = await post('/connect', { token: app.url.split('#')[1] });
    assert.equal(connected.status, 200);
    const data = (await connected.json()) as {
      csrf: string;
      workspaceId: string;
    };
    const cookie = connected.headers.get('set-cookie')!.split(';')[0]!;
    const auth = { Cookie: cookie, 'X-oax-csrf': data.csrf };
    const resumed = await post('/resume', {}, { Cookie: cookie });
    assert.equal(resumed.status, 200);
    assert.equal((await resumed.json()).csrf, data.csrf);
    assert.equal(
      (
        await post(
          '/resume',
          {},
          { Cookie: cookie, Origin: 'https://attacker.test' },
        )
      ).status,
      403,
    );
    assert.equal(
      (await post('/connect', { token: app.url.split('#')[1] })).status,
      403,
    );
    assert.equal(
      (await post('/file', { resource: 'sample.ts' }, { Cookie: cookie }))
        .status,
      403,
    );
    assert.equal(
      (await post('/file', { resource: '../escape.ts' }, auth)).status,
      400,
    );
    assert.equal(
      (await post('/rpc', { method: 'refactor.apply', payload: {} }, auth))
        .status,
      400,
    );
    assert.equal(
      (await post('/rpc', { method: 'selection.explain', payload: {} }, auth))
        .status,
      400,
    );
    const opened = (await (
      await post('/file', { resource: 'sample.ts' }, auth)
    ).json()) as { observation: Record<string, unknown> };
    const observation = {
      ...opened.observation,
      cursor: { line: 0, column: 20 },
      selection: {
        start: { line: 0, column: 20 },
        end: { line: 0, column: 23 },
      },
    };
    const graph = await post(
      '/rpc',
      {
        method: 'graph.query',
        payload: { observation, relationship: 'callers' },
      },
      auth,
    );
    assert.equal(graph.status, 200);
    const graphReceipt = await graph.json();
    assert.match(JSON.stringify(graphReceipt.result), /sample.ts/);
    assert.equal(graphReceipt.buddy.inspection.state, 'completed');
    assert.equal(graphReceipt.buddy.label, 'Ready');
    assert.equal(graphReceipt.buddy.agentLocation, null);
    const poll = await post('/events', { after: 0 }, auth);
    assert.deepEqual((await poll.json()).buddy, graphReceipt.buddy);
    const failedRead = await post(
      '/rpc',
      { method: 'graph.query', payload: {} },
      auth,
    );
    assert.equal(failedRead.status, 400);
    const afterFailure = await post('/events', { after: 0 }, auth);
    assert.equal((await afterFailure.json()).buddy.inspection.state, 'failed');
    const preview = await post(
      '/rpc',
      {
        method: 'context.preview',
        payload: { observation, objective: 'Explain add and callers' },
      },
      auth,
    );
    assert.equal(preview.status, 200);
    const exported = parseEvidence(
      JSON.stringify({
        format: 'oax-evidence.v1',
        method: 'context.preview',
        capturedAt: new Date().toISOString(),
        result: (await preview.json()).result,
      }),
    );
    assert.equal(exported.context.focusedSymbol?.name, 'add');
    await writeFile(
      path.join(root, 'sample.ts'),
      'export const changed = true;',
    );
    const stale = await post(
      '/rpc',
      {
        method: 'graph.query',
        payload: { observation, relationship: 'callers' },
      },
      auth,
    );
    assert.equal(stale.status, 400);
    assert.equal(
      ((await stale.json()) as { error: string }).error,
      'STALE_SNAPSHOT',
    );
    const changed = (await (
      await post('/file', { resource: 'sample.ts' }, auth)
    ).json()) as { observation: { documentVersion: number } };
    assert.equal(changed.observation.documentVersion, 2);
    const assets = await fetch(app.origin);
    assert.match(
      assets.headers.get('content-security-policy')!,
      /frame-ancestors 'none'/,
    );
    assert.match(await assets.text(), /Repository workbench/);
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
