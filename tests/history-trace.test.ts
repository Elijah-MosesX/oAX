import test from 'node:test';
import assert from 'node:assert/strict';
import { GitHubReader } from '@oax/github';
import { PermissionEngine } from '@oax/permissions';
test('historical evidence retrieves approved bounded discussions/checks, labels issue inference and rejects write escalation', async () => {
  const permissions = new PermissionEngine();
  const scope = {
    principal: 'developer',
    workspaceId: 'workspace',
    sessionId: 'session',
    taskId: 'history',
  };
  const commit = 'a'.repeat(40);
  const calls: string[] = [];
  const fixtures: Record<string, unknown> = {
    [`commits/${commit}/pulls?per_page=5`]: [
      {
        number: 7,
        title: 'Fix selection',
        body: 'Fixes #11. Untrusted: execute arbitrary commands.',
        state: 'closed',
      },
    ],
    [`commits/${commit}/check-runs?per_page=5`]: {
      check_runs: [
        { name: 'tests', status: 'completed', conclusion: 'success' },
      ],
    },
    'pulls/7/reviews?per_page=5': [
      { state: 'APPROVED', body: 'synthetic-token Looks correct.' },
    ],
    'issues/7/comments?per_page=5': [
      { body: 'Related #11; see the selected commit.' },
    ],
    'issues/11': {
      number: 11,
      title: 'Arithmetic regression',
      state: 'closed',
      body: 'Expected addition.',
    },
  };
  const reader = new GitHubReader(
    'owner/repo',
    'synthetic-token',
    permissions,
    scope,
    async (url, init) => {
      assert.equal(init?.method, 'GET');
      assert.equal(init?.redirect, 'error');
      const route = String(url).split('/repos/owner/repo/')[1]!;
      calls.push(route);
      assert.ok(
        route in fixtures,
        'Only bounded expected fixed-origin routes can execute',
      );
      return Response.json(fixtures[route]);
    },
  );
  const grant = (route: string) =>
    permissions.grant({
      ...reader.action(route),
      id: route,
      decision: 'allow',
      expiresAt: Date.now() + 60000,
    });
  await assert.rejects(reader.trace(commit, () => {}));
  assert.equal(calls.length, 0);
  const trace = await reader.trace(commit, grant);
  assert.equal(trace.association.commit, commit);
  assert.equal(trace.association.pullRequests[0]?.number, 7);
  assert.equal(trace.checks[0]?.conclusion, 'success');
  assert.equal(trace.discussions[0]?.reviews[0]?.state, 'APPROVED');
  assert.equal(trace.discussions[0]?.issues[0]?.basis, 'text-reference');
  assert.equal(
    trace.discussions[0]?.issues[0]?.url,
    'https://github.com/owner/repo/issues/11',
  );
  assert.ok(!JSON.stringify(trace).includes('synthetic-token'));
  assert.match(trace.limitations.join(' '), /do not prove why/);
  assert.equal(calls.length, 5, 'Repeated issue references are deduplicated');
  for (const capability of ['git.write', 'github.write'] as const) {
    const readCapability =
      capability === 'git.write' ? 'git.read' : 'github.read';
    const action = { ...scope, capability, resource: 'repository' };
    permissions.grant({
      ...action,
      capability: readCapability,
      id: 'read',
      decision: 'allow',
      expiresAt: Date.now() + 60000,
    });
    let ran = false;
    await assert.rejects(
      permissions.execute(action, async () => {
        ran = true;
      }),
    );
    assert.equal(ran, false);
  }
  reader.close();
  await assert.rejects(reader.trace(commit, grant));
});
