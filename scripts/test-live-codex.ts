import assert from 'node:assert/strict';
import { CodexTextClient } from '../packages/codex/src/text-client.js';
import { RuntimeClient } from '../packages/runtime/src/client.js';
import { observation, fixtureRoot } from '../tests/helpers.js';
import path from 'node:path';
async function main() {
  const executable = process.env.OAX_CODEX_EXECUTABLE;
  if (process.env.OAX_LIVE_TEST !== '1' || !executable)
    throw new Error(
      'Opt-in required: OAX_LIVE_TEST=1 and OAX_CODEX_EXECUTABLE',
    );
  const client = new CodexTextClient(executable);
  try {
    const preflight = await client.connect();
    assert.equal(
      preflight.authenticated,
      true,
      'Existing provider login required; oAX does not initiate login',
    );
    console.log(
      `Codex ${preflight.version} authenticated; no repository content sent.`,
    );
    const answer = await client.explain(
      'Explain this synthetic TypeScript function in one sentence: export function add(a: number, b: number) { return a + b; }',
    );
    assert.match(answer, /add|sum|addition|plus/i);
    console.log(
      'Live synthetic explain completed; text-only session policy verified.',
    );
  } finally {
    await client.close();
  }
  const runtime = await RuntimeClient.connect(
    path.resolve('dist/cli.cjs'),
    fixtureRoot,
    process.execPath,
    executable,
  );
  try {
    const { sessionId } = (await runtime.call('session.open', {})) as {
      sessionId: string;
    };
    const captured = observation(
      'export function add(a: number, b: number) { return a + b; }',
    );
    await assert.rejects(
      runtime.explain(
        sessionId,
        captured,
        'Explain the synthetic add function',
      ),
      'Missing context grant must prevent transmission',
    );
    const preview = (await runtime.call(
      'context.preview',
      {
        observation: captured,
        objective: 'Explain the synthetic add function',
      },
      sessionId,
    )) as { hash: string };
    const answer = await runtime.explain(
      sessionId,
      captured,
      'Explain the synthetic add function',
      undefined,
      preview.hash,
    );
    assert.match(answer, /add|sum|addition|plus/i);
    console.log(
      'Live stdio runtime -> scoped context consent -> Codex -> answer passed; missing consent denied.',
    );
    await runtime.call('session.close', {}, sessionId);
  } finally {
    runtime.dispose();
  }
}
void main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Live test failed');
  process.exitCode = 1;
});
