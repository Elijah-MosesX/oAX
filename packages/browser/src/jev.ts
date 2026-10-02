import { spawn } from 'node:child_process';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { z, OaxError } from '@oax/protocol';
import { PermissionEngine, type Action } from '@oax/permissions';
import { redact } from '@oax/context';
import sourceHashes from '../../../services/jev/pin.json';

export const JEV_COMMIT = '1231850a0bf1a0c0341fe408ef1668dbbfdfac46';
const short = z.string().max(2000);
const actionSchema = z
  .strictObject({
    id: short.min(1),
    kind: z.enum(['click', 'fill', 'select', 'scroll', 'wait']),
    node: short.optional(),
    label: short,
    role: short.optional(),
    value: short.optional(),
    current_value: short.optional(),
    checked: z.boolean().optional(),
    selected: z.boolean().optional(),
    expanded: z.boolean().optional(),
  })
  .superRefine((action, ctx) => {
    if (
      (action.kind === 'wait' && action.id !== 'wait') ||
      (action.kind === 'scroll' &&
        !['scroll_up', 'scroll_down'].includes(action.id))
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Unsupported control identifier',
      });
    if (['click', 'fill', 'select'].includes(action.kind) && !action.node)
      ctx.addIssue({
        code: 'custom',
        message: 'Observed element requires a node',
      });
    if (action.kind === 'select' && action.value === undefined)
      ctx.addIssue({
        code: 'custom',
        message: 'Select requires an observed value',
      });
  });
export const jevPageSchema = z
  .strictObject({
    url: z
      .url()
      .max(8192)
      .refine((value) => {
        const url = new URL(value);
        return (
          ['http:', 'https:'].includes(url.protocol) &&
          !url.username &&
          !url.password
        );
      }),
    title: short,
    text: z.string().max(16000),
    actions: z.array(actionSchema).max(200),
  })
  .superRefine((page, ctx) => {
    if (new Set(page.actions.map((a) => a.id)).size !== page.actions.length)
      ctx.addIssue({ code: 'custom', message: 'Duplicate action identifiers' });
  });
export type JevPage = z.infer<typeof jevPageSchema>;
export function jevContext(page: JevPage, goal: string) {
  const checked = jevPageSchema.parse(page);
  const objective = short.min(1).parse(goal);
  const clean = (value: string) => redact(value).text;
  const url = new URL(checked.url);
  url.search = '';
  url.hash = '';
  return {
    page: jevPageSchema.parse({
      ...checked,
      url: url.href,
      title: clean(checked.title),
      text: clean(checked.text),
      actions: checked.actions.map((action) => ({
        ...action,
        label: clean(action.label),
        ...(action.value === undefined ? {} : { value: clean(action.value) }),
        ...(action.current_value === undefined
          ? {}
          : { current_value: clean(action.current_value) }),
      })),
    }),
    goal: clean(objective),
  };
}
export function jevContextAction(
  scope: Omit<Action, 'capability' | 'resource'>,
  page: JevPage,
  goal: string,
): Action {
  const data = jevContext(page, goal);
  return {
    ...scope,
    capability: 'provider.context',
    resource: `jev:typesafe:${createHash('sha256').update(JSON.stringify(data)).digest('hex')}`,
  };
}

/** Proposes an observed operation. Never starts upstream Browser/Agent or executes its choice. */
export class JevPlanner {
  constructor(private readonly root: string) {}
  async inspect(page: JevPage): Promise<unknown> {
    return this.run('inspect', jevPageSchema.parse(page), '');
  }
  async predict(
    page: JevPage,
    goal: string,
    policy: PermissionEngine,
    scope: Omit<Action, 'capability' | 'resource'>,
  ): Promise<unknown> {
    const data = jevContext(page, goal);
    return policy.execute(jevContextAction(scope, data.page, data.goal), () =>
      this.run('predict', data.page, data.goal),
    );
  }
  private async run(
    mode: 'inspect' | 'predict',
    page: JevPage,
    goal: string,
  ): Promise<unknown> {
    const root = await realpath(this.root);
    const tools = await realpath(path.join(root, '.tools'));
    if (tools !== path.join(root, '.tools'))
      throw new OaxError('JEV_INSTALL', 'Redirected tool directory');
    const descriptor = z
      .strictObject({
        version: z.literal('0.1'),
        commit: z.literal(JEV_COMMIT),
        archiveSha256: z.literal(
          '61e3edab5be79a857647660bd24e60127b9a5881d71cf81f2c7d98bd99202b9d',
        ),
        uv: z.literal('0.12.22'),
        python: z.string(),
        source: z.string(),
        hashes: z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/)),
      })
      .parse(
        JSON.parse(
          await readFile(path.join(tools, 'jev-install.json'), 'utf8'),
        ),
      );
    const source = await realpath(descriptor.source);
    const python = await realpath(descriptor.python);
    if (
      source !== path.join(tools, 'jev-source', JEV_COMMIT) ||
      !python.startsWith(source + path.sep)
    )
      throw new OaxError('JEV_INSTALL', 'Use the pinned isolated installation');
    for (const [relative, hash] of Object.entries(sourceHashes)) {
      const file = await realpath(path.join(source, relative));
      if (
        !file.startsWith(path.join(source, 'jev_ultrafast') + path.sep) ||
        createHash('sha256')
          .update(await readFile(file))
          .digest('hex') !== hash
      )
        throw new OaxError(
          'JEV_INTEGRITY',
          'Planner source integrity check failed',
        );
    }
    if (
      !Object.keys(descriptor.hashes).some(
        (name) => name.replaceAll('\\', '/') === 'jev_ultrafast/model.py',
      )
    )
      throw new OaxError('JEV_INTEGRITY', 'Missing planner integrity record');
    const key = mode === 'predict' ? process.env.TYPESAFE_API_KEY : undefined;
    if (mode === 'predict' && !key)
      throw new OaxError(
        'JEV_CREDENTIAL',
        'Set TYPESAFE_API_KEY locally; no request was sent',
      );
    const worker = path.join(root, 'services', 'jev', 'worker.py');
    const data = JSON.stringify({ mode, page, goal }) + '\n';
    if (Buffer.byteLength(data) > 65536)
      throw new OaxError('PAYLOAD_LIMIT', 'Planner input exceeds 64 KiB');
    return new Promise((resolve, reject) => {
      const env: NodeJS.ProcessEnv = { PYTHONNOUSERSITE: '1', PYTHONUTF8: '1' };
      for (const name of ['SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP'])
        if (process.env[name]) env[name] = process.env[name];
      if (key) env.TYPESAFE_API_KEY = key;
      const child = spawn(python, ['-I', worker], {
        cwd: root,
        env,
        shell: false,
        windowsHide: true,
      });
      let output = '',
        settled = false;
      const finish = (error?: Error, value?: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        child.kill();
        if (error) reject(error);
        else resolve(value);
      };
      const timer = setTimeout(
        () =>
          finish(
            new OaxError(
              'JEV_TIMEOUT',
              'Planner timed out; no browser action executed',
            ),
          ),
        90000,
      );
      child.on('error', () =>
        finish(new OaxError('JEV_START', 'Planner could not start')),
      );
      child.stdin.on('error', () =>
        finish(new OaxError('JEV_INPUT', 'Planner input closed')),
      );
      child.stderr.resume();
      child.stdout.on('data', (chunk: Buffer) => {
        output += chunk.toString('utf8');
        if (Buffer.byteLength(output) > 65536)
          finish(new OaxError('PAYLOAD_LIMIT', 'Planner output exceeds limit'));
      });
      child.on('close', (code) => {
        if (code !== 0)
          return finish(
            new OaxError(
              'JEV_FAILED',
              'Planner failed; no browser action executed',
            ),
          );
        try {
          const result: unknown = JSON.parse(output);
          const checked =
            mode === 'inspect'
              ? z
                  .strictObject({
                    elements: z
                      .array(z.record(z.string(), z.unknown()))
                      .max(200),
                    operations: z.array(short).max(205),
                    executed: z.literal(false),
                  })
                  .parse(result)
              : z
                  .strictObject({
                    choice: short,
                    operation: z.enum([
                      'CLICK',
                      'TYPE_TEXT',
                      'SELECT',
                      'SCROLL_DOWN',
                      'SCROLL_UP',
                      'WAIT',
                      'DONE',
                      'BLOCKED',
                    ]),
                    target: short.nullable(),
                    confidence: z.number().min(0).max(1),
                    latency_ms: z.number().int().min(0),
                    executed: z.literal(false),
                    verified: z.literal(false),
                  })
                  .parse(result);
          if (mode === 'predict') {
            const decision = checked as { choice: string; operation: string };
            const kinds: Record<string, string> = {
              CLICK: 'click',
              TYPE_TEXT: 'fill',
              SELECT: 'select',
              SCROLL_UP: 'scroll',
              SCROLL_DOWN: 'scroll',
              WAIT: 'wait',
            };
            if (
              !['DONE', 'BLOCKED'].includes(decision.operation) &&
              !page.actions.some(
                (action) =>
                  action.id === decision.choice &&
                  action.kind === kinds[decision.operation],
              )
            )
              throw new Error('Choice is outside observed action space');
          }
          finish(undefined, checked);
        } catch {
          finish(new OaxError('JEV_RESPONSE', 'Invalid planner response'));
        }
      });
      child.stdin.end(data);
    });
  }
}
