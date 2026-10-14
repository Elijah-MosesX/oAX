import { spawn } from 'node:child_process';
import { readFile, realpath, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { z } from '@oax/protocol';
/** An app window over the same local surface; no independent graph or agent harness. */
export async function desktopWindow(
  checkout: string,
  url: string,
  close: () => Promise<void>,
  probe = false,
) {
  const root = await realpath(checkout);
  const installation = z
    .object({ executable: z.string() })
    .parse(
      JSON.parse(
        await readFile(path.join(root, '.oax', 'browser-install.json'), 'utf8'),
      ),
    );
  const executable = await realpath(
    path.resolve(root, installation.executable),
  );
  if (
    !executable.startsWith(path.join(root, '.oax', 'browser-cache') + path.sep)
  )
    throw new Error('Use the dedicated testing browser');
  if (
    createHash('sha256')
      .update(await readFile(executable))
      .digest('hex') !==
    'f0b204ce7239e221f84c4030cd38e4b688ad05320acc8373da166f548bf57eb5'
  )
    throw new Error('Desktop browser checksum mismatch');
  const profile = await mkdtemp(path.join(tmpdir(), 'oax-workbench-'));
  const child = spawn(
    executable,
    [
      `--app=${url}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-sync',
      '--disable-extensions',
      '--disable-background-networking',
      ...(probe
        ? [
            '--remote-debugging-port=0',
            '--enable-logging',
            '--log-level=1',
            `--log-file=${path.join(profile, 'startup.log')}`,
          ]
        : []),
    ],
    { shell: false, windowsHide: false, stdio: 'ignore' },
  );
  const exited = new Promise<{ code: number | null; failedToStart: boolean }>(
    (resolve) => {
      child.once('exit', (code) => resolve({ code, failedToStart: false }));
      child.once('error', () => resolve({ code: null, failedToStart: true }));
    },
  );
  let disposed = false;
  const dispose = async () => {
    if (disposed) return;
    disposed = true;
    if (child.exitCode === null && child.pid) {
      if (process.platform === 'win32')
        await new Promise<void>((resolve) => {
          const stop = spawn(
            'taskkill.exe',
            ['/PID', String(child.pid), '/T', '/F'],
            { windowsHide: true, stdio: 'ignore', shell: false },
          );
          const timeout = setTimeout(() => {
            stop.kill();
            child.kill();
            resolve();
          }, 5000);
          stop.once('error', () => {
            clearTimeout(timeout);
            child.kill();
            resolve();
          });
          stop.once('exit', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      else child.kill();
    }
    await close();
    if (
      path.dirname(profile) !== tmpdir() ||
      !path.basename(profile).startsWith('oax-workbench-')
    )
      throw new Error('Unexpected desktop profile');
    await rm(profile, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 200,
    });
  };
  child.once('exit', () => {
    void dispose().catch(() => {
      process.exitCode = 1;
    });
  });
  child.once('error', () => {
    void dispose().catch(() => {
      process.exitCode = 1;
    });
  });
  return { dispose, profile, exited };
}
