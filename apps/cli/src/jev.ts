import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  JevPlanner,
  jevPageSchema,
  jevContextAction,
  jevContext,
} from '../../../packages/browser/src/jev.js';
import { PermissionEngine } from '@oax/permissions';
import { openAudit } from '../../../packages/runtime/src/audit.js';

async function main() {
  const [command, file, goal, flag, approved] = process.argv.slice(2);
  if (
    !file ||
    !['inspect', 'plan'].includes(command ?? '') ||
    (flag !== undefined && flag !== '--approve') ||
    process.argv.length > 7
  ) {
    console.log(
      'Usage: node dist/jev.cjs inspect <observed-page.json>\n       node dist/jev.cjs plan <observed-page.json> <goal> [--approve <context-resource>]\nPlan previews disclosure before transmission. No browser action is executed.',
    );
    process.exitCode = command ? 2 : 0;
    return;
  }
  const root = path.resolve(__dirname, '..');
  const input = await readFile(file);
  if (input.length > 65536) throw new Error('Observed page exceeds 64 KiB');
  const page = jevPageSchema.parse(JSON.parse(input.toString('utf8')));
  const planner = new JevPlanner(root);
  if (command === 'inspect') {
    if (goal) throw new Error('Inspect accepts only a page file');
    console.log(JSON.stringify(await planner.inspect(page), null, 2));
    return;
  }
  if (!goal) throw new Error('Specify a bounded goal');
  const scope = {
    principal: 'local-cli',
    workspaceId: root,
    sessionId: randomUUID(),
    taskId: randomUUID(),
  };
  const action = jevContextAction(scope, page, goal);
  if (!flag) {
    console.log(
      JSON.stringify(
        {
          resource: action.resource,
          destination: 'https://api.typesafe.ai/v1/systemone',
          ...jevContext(page, goal),
          disclosure:
            'This exact page and goal will be sent to TypeSafe and may incur usage. No execution or outcome verification is authorized.',
        },
        null,
        2,
      ),
    );
    return;
  }
  if (approved !== action.resource)
    throw new Error('Approve the exact context resource');
  const journal = await openAudit(root);
  const policy = new PermissionEngine(Date.now, journal.record);
  try {
    policy.grant({
      ...action,
      id: randomUUID(),
      decision: 'allow',
      expiresAt: Date.now() + 100000,
    });
    console.log(
      JSON.stringify(await planner.predict(page, goal, policy, scope), null, 2),
    );
  } finally {
    policy.close(scope.sessionId);
    await journal.close();
  }
}
void main().catch(() => {
  console.error(
    'Jev operation failed; verify installation, input, exact approval and local TYPESAFE_API_KEY. No browser action executed.',
  );
  process.exitCode = 1;
});
