import path from 'node:path';
import { startWorkbench } from './server.js';
import { desktopWindow } from './desktop.js';
const root = process.argv[2] ?? process.cwd();
void startWorkbench(
  root,
  path.join(__dirname, 'cli.cjs'),
  path.join(__dirname, '..', 'apps', 'workbench', 'public'),
)
  .then(async (app) => {
    console.log(
      `oAX local workbench: ${app.url}\nSingle-use link. Local source inspection; no model calls or edits. Ctrl+C closes the owned runtime.`,
    );
    if (
      process.argv.length > 4 ||
      (process.argv[3] && process.argv[3] !== '--desktop')
    ) {
      await app.close();
      throw new Error('Unexpected argument');
    }
    const desktop =
      process.argv[3] === '--desktop'
        ? await desktopWindow(
            path.join(__dirname, '..'),
            app.url,
            app.close,
            Boolean(process.send && process.env.OAX_DESKTOP_PROBE === '1'),
          ).catch(async (error: unknown) => {
            await app.close();
            throw error;
          })
        : undefined;
    const report = (message: Record<string, unknown>) => {
      // Probe delivery can race with parent/owned-window shutdown. A closed
      // diagnostic channel must not turn successful cleanup into a crash.
      if (process.connected)
        process.send?.(message, undefined, undefined, () => {});
    };
    let closing: Promise<void> | undefined;
    const close = () => {
      closing ??= (desktop ? desktop.dispose() : app.close())
        .catch(() => {
          console.error(
            'Owned desktop cleanup failed; inspect the temporary profile.',
          );
          process.exitCode = 1;
        })
        .finally(() => {
          if (process.connected) process.disconnect();
        });
    };
    if (process.send) {
      report({
        type: 'workbench.ready',
        origin: app.origin,
        ...(desktop ? { profile: desktop.profile } : { url: app.url }),
      });
      process.on('message', (message: unknown) => {
        if (message === 'close') close();
        if (message === 'inspect')
          report({
            type: 'transport.inspection',
            ...app.inspectTransport(),
          });
      });
      process.once('disconnect', close);
    }
    if (desktop)
      void app.connection.then(() => {
        console.log('Desktop window authenticated to its owned runtime.');
        report({ type: 'desktop.authenticated' });
      });
    if (desktop)
      void desktop.exited.then((exit) =>
        report({ type: 'desktop.exit', ...exit }),
      );
    process.once('SIGINT', close);
    process.once('SIGTERM', close);
  })
  .catch(() => {
    console.error(
      'Workbench could not start. Verify workspace and built runtime.',
    );
    process.exitCode = 1;
  });
