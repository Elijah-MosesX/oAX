// Test-only private stdio fixture: no provider, source writes or production hooks.
import readline from 'node:readline';
import { createHash } from 'node:crypto';
const send = (message) =>
  process.stdout.write(
    JSON.stringify({
      version: '0.1',
      workspaceId: 'fixture',
      sessionId: 'fixture',
      ...message,
    }) + '\n',
  );
send({
  type: 'response',
  correlationId: 'adapter-bootstrap',
  ok: true,
  payload: {
    contract: 'editor-read-only.v1',
    engine: 'mock',
    workspaceId: 'fixture',
    sessionId: 'fixture',
  },
});
let sequence = 0;
readline.createInterface({ input: process.stdin }).on('line', (line) => {
  const request = JSON.parse(line);
  const observation = request.payload.observation;
  if (request.method === 'selection.explain') {
    const scenario = request.payload.objective;
    const event = (method, payload, extra = {}) =>
      send({
        type: 'event',
        taskId: 'fixture-task',
        sequence: ++sequence,
        method,
        payload,
        ...extra,
      });
    const location = {
      path: observation.path,
      contentHash: createHash('sha256').update(observation.text).digest('hex'),
      documentVersion: observation.documentVersion,
      mode: 'investigating',
      range: observation.selection,
    };
    if (['completed', 'failed', 'cancelled'].includes(scenario))
      event('task.state', { state: scenario });
    else {
      if (scenario !== 'late') event('task.state', { state: 'created' });
      if (scenario === 'hash') location.contentHash = '0'.repeat(64);
      if (scenario === 'missing') delete location.contentHash;
      if (scenario === 'version') location.documentVersion--;
      if (scenario === 'outside') location.path = '../sample.ts';
      if (scenario === 'hidden') location.path = 'consumer.ts';
      event(
        'agent.cursor.changed',
        location,
        scenario === 'scope' ? { sessionId: 'other' } : {},
      );
    }
    send({
      type: 'response',
      correlationId: request.id,
      ok: true,
      payload: { method: request.method },
    });
    return;
  }
  const payload =
    request.method === 'spatial.observe'
      ? {
          documentVersion: observation.documentVersion,
          focused: {
            path: observation.path,
            hash: createHash('sha256').update(observation.text).digest('hex'),
            name: 'fixture',
          },
        }
      : { method: request.method };
  if (observation?.path === 'wrong-hash.ts')
    payload.focused.hash = '0'.repeat(64);
  if (observation?.path === 'wrong-path.ts') payload.focused.path = 'other.ts';
  if (observation?.path === 'wrong-version.ts') payload.documentVersion++;
  setTimeout(
    () =>
      send({ type: 'response', correlationId: request.id, ok: true, payload }),
    request.method === 'spatial.observe' ? 300 : 10,
  );
});
