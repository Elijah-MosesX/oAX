import { spawn, execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { digest } from '@oax/codegraph';
import { workspacePath, redact } from '@oax/context';
import { OaxError, checkPlanSchema } from '@oax/protocol';
import { PermissionEngine, type Action } from '@oax/permissions';
export interface CheckPlan {
  id: string;
  hash: string;
  expiresAt: number;
  path: string;
  sourceHash: string;
  executable: string;
  args: string[];
  cwd: string;
  timeoutMs: number;
  disclosure: string;
  state: 'awaiting_approval';
}
export async function prepareChecks(
  root: string,
  resource: string,
  id: string,
): Promise<CheckPlan> {
  if (!/\.(?:test|spec)\.(?:[cm]?[jt]s)$/.test(resource))
    throw new OaxError(
      'CHECK_SCOPE',
      'Select a saved .test/.spec TypeScript or JavaScript file; TSX and package-script execution are not supported',
    );
  const absolute = await workspacePath(root, resource);
  const sourceHash = digest(await readFile(absolute, 'utf8'));
  const operation = {
    path: resource,
    sourceHash,
    executable: process.execPath,
    args: ['--test', absolute],
    cwd: root,
    timeoutMs: 5000,
    disclosure:
      'Executes the selected test and its dependencies with local-account rights. It may modify files or make network requests. No OS sandbox is claimed; environment inheritance is restricted. Timeout: 5 seconds.',
  };
  return checkPlanSchema.parse({
    ...operation,
    id,
    hash: digest(JSON.stringify(operation)),
    expiresAt: Date.now() + 60000,
    state: 'awaiting_approval',
  });
}
export async function executeChecks(
  plan: CheckPlan,
  permissions: PermissionEngine,
  scope: Omit<Action, 'capability' | 'resource'>,
  signal: AbortSignal,
  onOutput: (text: string) => void,
): Promise<{ exitCode: number | null }> {
  if (plan.expiresAt <= Date.now())
    throw new OaxError('PERMISSION_DENIED', 'Verification plan expired');
  const source = await readFile(
    await workspacePath(plan.cwd, plan.path),
    'utf8',
  );
  if (digest(source) !== plan.sourceHash)
    throw new OaxError(
      'CHECK_CONFLICT',
      'Selected test changed; approve a fresh preview',
    );
  return permissions.execute(
    {
      ...scope,
      capability: 'terminal.execute',
      resource: `node-test:${plan.hash}`,
    },
    () =>
      new Promise((resolve, reject) => {
        signal.throwIfAborted();
        const child = spawn(plan.executable, plan.args, {
          cwd: plan.cwd,
          shell: false,
          windowsHide: true,
          detached: process.platform !== 'win32',
          stdio: ['ignore', 'pipe', 'pipe'],
          env: {
            PATH: process.env.PATH ?? '',
            SystemRoot: process.env.SystemRoot ?? '',
            TEMP: process.env.TEMP ?? '',
            TMP: process.env.TMP ?? '',
            ELECTRON_RUN_AS_NODE: '1',
          },
        });
        let bytes = 0;
        let failure: OaxError | undefined;
        let termination: Promise<void> = Promise.resolve();
        const stop = (error: OaxError) => {
          if (failure) return;
          failure = error;
          if (child.pid && process.platform === 'win32')
            termination = new Promise<void>((done) =>
              execFile(
                path.join(
                  process.env.SystemRoot ?? 'C:\\Windows',
                  'System32',
                  'taskkill.exe',
                ),
                ['/PID', String(child.pid), '/T', '/F'],
                { windowsHide: true, timeout: 5000 },
                () => {
                  child.kill();
                  done();
                },
              ),
            );
          else if (child.pid) {
            try {
              process.kill(-child.pid, 'SIGTERM');
            } catch {
              child.kill();
            }
          } else child.kill();
        };
        const abort = () =>
          stop(
            new OaxError(
              'CANCELLED',
              'Test execution cancelled; completed side effects are not rolled back',
            ),
          );
        signal.addEventListener('abort', abort, { once: true });
        const timer = setTimeout(
          () =>
            stop(
              new OaxError(
                'CHECK_TIMEOUT',
                'Test execution exceeded five seconds',
              ),
            ),
          plan.timeoutMs,
        );
        const chunks: Buffer[] = [];
        const collect = (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > 65536)
            stop(
              new OaxError(
                'OUTPUT_LIMIT',
                'Verification output exceeded 64 KiB',
              ),
            );
          else chunks.push(chunk);
        };
        child.stdout.on('data', collect);
        child.stderr.on('data', collect);
        child.once('error', () => {
          failure = new OaxError(
            'CHECK_START_FAILED',
            'Node test process could not start',
          );
        });
        child.once('close', async (exitCode) => {
          clearTimeout(timer);
          signal.removeEventListener('abort', abort);
          // Windows can close the parent pipes before taskkill releases its cwd.
          await termination;
          const output = redact(Buffer.concat(chunks).toString('utf8')).text;
          for (let offset = 0; offset < output.length; offset += 16000)
            onOutput(output.slice(offset, offset + 16000));
          if (failure) reject(failure);
          else resolve({ exitCode });
        });
      }),
  );
}
