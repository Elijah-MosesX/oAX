import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { RuntimeClient } from '../../packages/runtime/src/client.js';
import { capture } from '../../adapters/vscode/src/capture.js';
import { fixtureRoot, observation } from '../helpers.js';
import { eventSchema } from '@oax/protocol';
test('editor translation -> real stdio runtime -> context -> mock -> adapter answer', async () => {
  const client = await RuntimeClient.connect(
    path.resolve('dist/cli.cjs'),
    fixtureRoot,
  );
  const events: import('@oax/protocol').Event[] = [];
  const unsubscribe = client.subscribe((event) =>
    events.push(eventSchema.parse(event)),
  );
  try {
    const { sessionId } = (await client.call('session.open', {})) as {
      sessionId: string;
    };
    const input = observation();
    const snapshot = capture(fixtureRoot, {
      fileName: path.join(fixtureRoot, 'example.ts'),
      uri: input.uri,
      version: input.documentVersion,
      dirty: input.dirty,
      text: input.text,
      cursor: input.cursor,
      selection: input.selection,
      visibleRanges: [],
      openFiles: [path.join(fixtureRoot, 'example.ts')],
    });
    const answer = await client.explain(sessionId, snapshot);
    assert.match(answer, /Mock engine/);
    assert.match(answer, /unsaved = 7/);
    assert.match(answer, /document version 2/);
    assert.match(answer, /unsaved buffer/);
    const taskEvents = events.filter(
      (event) => event.sessionId === sessionId && event.method === 'task.state',
    );
    assert.deepEqual(
      taskEvents.map((event) =>
        event.method === 'task.state' ? event.payload.state : undefined,
      ),
      [
        'created',
        'gathering_context',
        'planning',
        'executing',
        'verifying',
        'completed',
      ],
    );
    assert.ok(
      events.every(
        (event, index) =>
          index === 0 || event.sequence > events[index - 1]!.sequence,
      ),
    );
    assert.ok(
      taskEvents.every(
        (event) =>
          event.taskId === taskEvents[0]!.taskId &&
          event.correlationId === taskEvents[0]!.correlationId,
      ),
    );
    await client.call('session.close', {}, sessionId);
    await assert.rejects(client.explain(sessionId, snapshot));
  } finally {
    unsubscribe();
    client.dispose();
  }
});
test('disconnect rejects pending requests and closed clients reject further use', async () => {
  const client = await RuntimeClient.connect(
    path.resolve('dist/cli.cjs'),
    fixtureRoot,
  );
  const pending = client.call('session.open', {});
  client.dispose();
  await assert.rejects(pending);
  await assert.rejects(client.call('session.open', {}));
});
