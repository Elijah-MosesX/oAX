import test from 'node:test';
import assert from 'node:assert/strict';
import { supportedCodexVersion } from '../packages/codex/src/text-client.js';
test('provider accepts only contract-verified exact versions, never a wildcard alpha', () => {
  assert.equal(supportedCodexVersion('codex-cli 0.159.2\n'), '0.159.2');
  assert.equal(
    supportedCodexVersion('codex-cli 0.159.0-alpha.12.1'),
    '0.159.0-alpha.12.1',
  );
  for (const unknown of [
    'codex-cli 0.162.0-alpha.3',
    'codex-cli 0.162.0-alpha.17.3',
    'codex-cli 0.159.0-alpha.12.2',
    'codex-cli 0.160.0',
    '0.159.2',
  ])
    assert.equal(supportedCodexVersion(unknown), undefined);
  assert.equal(
    supportedCodexVersion('codex-cli 0.162.0-alpha.2'),
    '0.162.0-alpha.2',
  );
  assert.equal(
    supportedCodexVersion('codex-cli 0.162.0-alpha.17.2'),
    '0.162.0-alpha.17.2',
  );
});
