import { readFile, realpath } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { workspacePath } from '@oax/context';
import { OaxError, type Observation } from '@oax/protocol';
import { RuntimeClient } from '../../../packages/runtime/src/client.js';
import type { MemoryPlan } from '../../../packages/runtime/src/memory.js';

export async function memoryCommand(entry: string, args: string[]) {
  const [command, target, note, days, flag, approvedHash] = args;
  if (
    !(command === 'list' && args.length === 1) &&
    !(command === 'suggest' && args.length === 3 && target && note) &&
    !(
      command === 'delete' &&
      args.length === 4 &&
      note === '--approve' &&
      days
    ) &&
    !(
      command === 'save' &&
      target &&
      note &&
      days &&
      (args.length === 4 ||
        (args.length === 6 && flag === '--approve' && approvedHash))
    )
  )
    throw new OaxError(
      'INVALID_ARGS',
      'memory list | memory suggest <path> <quoted-objective> | memory save <path> <quoted-note> <retention-days> [--approve <hash>] | memory delete <id> --approve <record-hash>',
    );
  const root = await realpath(process.cwd());
  const client = await RuntimeClient.connect(entry, root);
  try {
    const { sessionId } = (await client.call('session.open', {})) as {
      sessionId: string;
    };
    let result: unknown;
    if (command === 'list')
      result = await client.call('memory.list', {}, sessionId);
    else if (command === 'delete')
      result = await client.call(
        'memory.delete',
        { id: target, approvedHash: days },
        sessionId,
      );
    else {
      const file = await workspacePath(root, target!);
      const text = await readFile(file, 'utf8');
      const lines = text.split('\n');
      const observation: Observation = {
        path: target!,
        uri: pathToFileURL(file).href,
        text,
        dirty: false,
        documentVersion: 1,
        cursor: { line: 0, column: 0 },
        selection: {
          start: { line: 0, column: 0 },
          end: {
            line: lines.length - 1,
            column: lines.at(-1)!.replace(/\r$/, '').length,
          },
        },
        visibleRanges: [],
        openFiles: [target!],
      };
      if (command === 'suggest')
        result = await client.call(
          'memory.suggest',
          { observation, objective: note },
          sessionId,
        );
      else {
        const plan = (await client.call(
          'memory.prepare',
          { observation, note, retentionDays: Number(days) },
          sessionId,
        )) as MemoryPlan;
        result = approvedHash
          ? await client.call(
              'memory.save',
              { planId: plan.id, approvedHash },
              sessionId,
            )
          : plan;
      }
    }
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    await client.call('session.close', {}, sessionId);
  } finally {
    client.dispose();
  }
}
