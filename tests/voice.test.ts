import test from 'node:test';
import assert from 'node:assert/strict';
import { Voice } from '../deployments/team/src/voice.js';
test('voice requires consent, bounds recognition, and discards late transcripts after cancellation', () => {
  let starts = 0,
    aborts = 0;
  const sessions: FakeRecognition[] = [];
  class FakeRecognition {
    lang = '';
    continuous = true;
    interimResults = true;
    onresult:
      | ((event: {
          results: { isFinal: boolean; 0: { transcript: string } }[];
        }) => void)
      | null = null;
    onerror: ((event: { error: string }) => void) | null = null;
    onend: (() => void) | null = null;
    constructor() {
      sessions.push(this);
    }
    start() {
      starts++;
    }
    stop() {
      this.onend?.();
    }
    abort() {
      aborts++;
    }
  }
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      SpeechRecognition: FakeRecognition,
      speechSynthesis: { cancel() {}, getVoices: () => [] },
    },
  });
  const drafts: string[] = [],
    status: string[] = [];
  try {
    Voice.start(
      false,
      (text) => drafts.push(text),
      (text) => status.push(text),
    );
    assert.equal(starts, 0);
    Voice.start(
      true,
      (text) => drafts.push(text),
      (text) => status.push(text),
    );
    assert.equal(starts, 1);
    const session = sessions[0]!;
    assert.equal(session.continuous, false);
    assert.equal(session.interimResults, false);
    session.onresult!({
      results: [{ isFinal: true, 0: { transcript: 'Review this draft' } }],
    });
    assert.deepEqual(drafts, ['Review this draft']);
    Voice.cancel();
    session.onresult!({
      results: [{ isFinal: true, 0: { transcript: 'late secret' } }],
    });
    assert.deepEqual(drafts, ['Review this draft']);
    assert.equal(aborts, 1);
    Voice.speak('private text', (text) => status.push(text));
    assert.match(status.at(-1)!, /No local English/);
  } finally {
    Voice.cancel();
    if (original) Object.defineProperty(globalThis, 'window', original);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
