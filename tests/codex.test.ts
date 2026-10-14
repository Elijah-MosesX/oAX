import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { CodexRpc } from '../packages/codex/src/rpc.js';
test('provider RPC correlates responses, streams notifications, and fails closed on server tool requests', async () => {
  const input = new PassThrough(),
    output = new PassThrough();
  const rpc = new CodexRpc(input, output, 100);
  const sent: string[] = [];
  output.on('data', (chunk) => sent.push(chunk.toString()));
  const events: string[] = [];
  rpc.subscribe((event) => events.push(event.method));
  const response = rpc.request('initialize', {});
  await new Promise((resolve) => setImmediate(resolve));
  input.write(JSON.stringify({ id: 1, result: { ready: true } }) + '\n');
  assert.deepEqual(await response, { ready: true });
  input.write(
    JSON.stringify({
      method: 'item/agentMessage/delta',
      params: { delta: 'hello' },
    }) + '\n',
  );
  const pending = rpc.request('turn/start', {});
  input.write(
    JSON.stringify({
      id: 'server-1',
      method: 'item/commandExecution/requestApproval',
      params: {},
    }) + '\n',
  );
  await assert.rejects(pending);
  await rpc.done;
  assert.deepEqual(events, [
    'item/agentMessage/delta',
    'oax/serverRequestDenied',
  ]);
  assert.ok(sent.some((frame) => frame.includes('text-only provider rejects')));
});
test('provider request timeout and disconnect reject outstanding work', async () => {
  const input = new PassThrough(),
    output = new PassThrough();
  const rpc = new CodexRpc(input, output, 5);
  await assert.rejects(
    rpc.request('account/read', { secret: 'must-not-appear' }),
    {
      code: 'PROVIDER_TIMEOUT',
      message: 'Codex request timed out: account/read',
    },
  );
  const pending = rpc.request('initialize', {});
  input.end();
  await assert.rejects(pending);
  await rpc.done;
});
