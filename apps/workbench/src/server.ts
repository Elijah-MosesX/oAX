import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { readFile, realpath, stat, open } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes, createHash } from 'node:crypto';
import { z, observationSchema, OaxError, type Event } from '@oax/protocol';
import { workspacePath } from '@oax/context';
import { RuntimeClient } from '../../../packages/runtime/src/client.js';

const methods = [
  'spatial.observe',
  'graph.query',
  'index.status',
  'context.preview',
  'repository.onboard',
  'history.query',
  'review.get',
] as const;
async function savedSource(root: string, resource: string) {
  const file = await workspacePath(root, resource);
  const handle = await open(file, 'r');
  try {
    const metadata = await handle.stat();
    const current = await stat(file);
    if (
      !metadata.isFile() ||
      (await realpath(file)) !== file ||
      metadata.ino !== current.ino ||
      metadata.dev !== current.dev
    )
      throw new OaxError(
        'PATH_DENIED',
        'Source identity changed during opening',
      );
    const buffer = Buffer.alloc(131073);
    let size = 0;
    while (size < buffer.length) {
      const { bytesRead } = await handle.read(
        buffer,
        size,
        buffer.length - size,
        size,
      );
      if (!bytesRead) break;
      size += bytesRead;
    }
    const after = await handle.stat();
    if (size > 131072 || buffer.subarray(0, size).includes(0))
      throw new OaxError('PAYLOAD_LIMIT', 'Choose bounded text source');
    if (metadata.mtimeMs !== after.mtimeMs || metadata.size !== after.size)
      throw new OaxError('STALE_SNAPSHOT', 'Source changed during reading');
    return { file, bytes: buffer.subarray(0, size) };
  } finally {
    await handle.close();
  }
}
/** Loopback-only single-user surface. It owns transport, not graph or agent state. */
export async function startWorkbench(
  rootPath: string,
  runtimePath: string,
  assets: string,
) {
  const root = await realpath(rootPath);
  const client = await RuntimeClient.connect(runtimePath, root);
  const { sessionId } = z
    .object({ sessionId: z.string() })
    .parse(await client.call('session.open', {}));
  const bootstrap = randomBytes(32).toString('hex'),
    cookie = randomBytes(32).toString('hex'),
    csrf = randomBytes(32).toString('hex');
  const created = Date.now();
  let connected = false,
    busy = false,
    disconnected = false;
  let resolveConnected: () => void = () => {};
  const connection = new Promise<void>((resolve) => {
    resolveConnected = resolve;
  });
  let sequence = 0;
  const events: { index: number; event: Event }[] = [];
  client.subscribe((event) => {
    events.push({ index: ++sequence, event });
    if (events.length > 200) events.shift();
  });
  client.onDisconnect(() => {
    disconnected = true;
  });
  const versions = new Map<string, { hash: string; version: number }>();
  let origin = '';
  let windowStart = Date.now(),
    requests = 0;
  const transportChecks = {
    connects: 0,
    suppliedTokenLength: 0,
    deniedOrigin: 0,
    deniedHost: 0,
  };
  const send = (res: ServerResponse, status: number, value: unknown) => {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify(value));
  };
  async function body(req: IncomingMessage): Promise<unknown> {
    if (req.headers['content-type'] !== 'application/json')
      throw new OaxError('CONTENT_TYPE', 'Use application/json');
    let size = 0;
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 196608)
        throw new OaxError('PAYLOAD_LIMIT', 'Request exceeds limit');
      chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }
  const server = createServer((req, res) => {
    void (async () => {
      if (Date.now() - windowStart > 60000) {
        windowStart = Date.now();
        requests = 0;
      }
      if (++requests > 500) return send(res, 429, { error: 'RATE_LIMIT' });
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; script-src 'self'; worker-src 'self'; manifest-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
      );
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Referrer-Policy', 'no-referrer');
      res.setHeader(
        'Permissions-Policy',
        'microphone=(), camera=(), geolocation=()',
      );
      if (req.headers.host !== new URL(origin).host) {
        transportChecks.deniedHost++;
        return send(res, 403, { error: 'HOST_DENIED' });
      }
      if (req.headers['sec-fetch-site'] === 'cross-site')
        return send(res, 403, { error: 'ORIGIN_DENIED' });
      const url = new URL(req.url ?? '/', origin);
      if (
        req.method === 'GET' &&
        [
          '/',
          '/app.js',
          '/style.css',
          '/manifest.webmanifest',
          '/sw.js',
          '/icon.svg',
          '/icon-192.png',
          '/icon-512.png',
          '/offline.html',
        ].includes(url.pathname)
      ) {
        const file =
          url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
        const contents = await readFile(path.join(assets, file));
        res.writeHead(200, {
          'Content-Type': file.endsWith('.png')
            ? 'image/png'
            : file.endsWith('.webmanifest')
              ? 'application/manifest+json'
              : file.endsWith('.svg')
                ? 'image/svg+xml'
                : file.endsWith('.js')
                  ? 'text/javascript'
                  : file.endsWith('.css')
                    ? 'text/css'
                    : 'text/html',
          'Cache-Control': 'no-store',
        });
        res.end(contents);
        return;
      }
      if (req.method !== 'POST' || req.headers.origin !== origin) {
        transportChecks.deniedOrigin++;
        return send(res, 403, { error: 'ORIGIN_DENIED' });
      }
      if (
        url.pathname === '/resume' &&
        connected &&
        Date.now() - created <= 3600000 &&
        req.headers.cookie?.split('; ').includes(`oax=${cookie}`)
      ) {
        await body(req);
        return send(res, 200, { csrf, workspace: root });
      }
      if (url.pathname === '/connect') {
        transportChecks.connects++;
        const data = z
          .strictObject({ token: z.string() })
          .parse(await body(req));
        transportChecks.suppliedTokenLength = data.token.length;
        if (
          connected ||
          Date.now() - created > 300000 ||
          data.token !== bootstrap
        )
          return send(res, 403, { error: 'BOOTSTRAP_DENIED' });
        connected = true;
        resolveConnected();
        res.setHeader(
          'Set-Cookie',
          `oax=${cookie}; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600`,
        );
        return send(res, 200, {
          csrf,
          workspace: root,
          workspaceId: client.identity,
          sessionId,
          contract: 'local-workbench.v1',
          engine: 'graph-only; live explain uses CLI or IDE',
        });
      }
      if (
        !connected ||
        Date.now() - created > 3600000 ||
        req.headers.cookie !== `oax=${cookie}` ||
        req.headers['x-oax-csrf'] !== csrf
      )
        return send(res, 403, { error: 'AUTH_REQUIRED' });
      if (disconnected)
        return send(res, 503, { error: 'RUNTIME_DISCONNECTED' });
      const data = await body(req);
      if (url.pathname === '/events') {
        const { after } = z
          .strictObject({ after: z.number().int().min(0) })
          .parse(data);
        return send(res, 200, {
          events: events.filter((item) => item.index > after),
          latest: sequence,
          truncated: events.length > 0 && after < events[0]!.index - 1,
        });
      }
      if (busy) return send(res, 409, { error: 'BUSY' });
      busy = true;
      try {
        if (url.pathname === '/file') {
          const { resource } = z
            .strictObject({ resource: z.string().min(1).max(4096) })
            .parse(data);
          const { file, bytes } = await savedSource(root, resource);
          const text = bytes.toString('utf8'),
            hash = createHash('sha256').update(bytes).digest('hex');
          const old = versions.get(resource),
            version = old ? old.version + Number(old.hash !== hash) : 1;
          if (versions.size >= 100 && !old)
            throw new OaxError(
              'RESOURCE_LIMIT',
              'Reconnect to open more files',
            );
          versions.set(resource, { hash, version });
          return send(res, 200, {
            observation: observationSchema.parse({
              path: resource,
              uri: pathToFileURL(file).href,
              documentVersion: version,
              dirty: false,
              text,
              cursor: { line: 0, column: 0 },
              selection: {
                start: { line: 0, column: 0 },
                end: { line: 0, column: 0 },
              },
              visibleRanges: [],
              openFiles: [resource],
            }),
          });
        }
        if (url.pathname === '/rpc') {
          const request = z
            .strictObject({ method: z.enum(methods), payload: z.unknown() })
            .parse(data);
          if ('observation' in Object(request.payload)) {
            const observation = observationSchema.parse(
              (request.payload as { observation: unknown }).observation,
            );
            const opened = versions.get(observation.path);
            const { file, bytes: current } = await savedSource(
              root,
              observation.path,
            );
            if (
              current.length > 131072 ||
              !opened ||
              observation.dirty ||
              observation.documentVersion !== opened.version ||
              observation.uri !== pathToFileURL(file).href ||
              observation.text !== current.toString('utf8') ||
              createHash('sha256').update(current).digest('hex') !== opened.hash
            )
              throw new OaxError(
                'STALE_SNAPSHOT',
                'Reopen the changed saved file before querying evidence',
              );
          }
          return send(res, 200, {
            result: await client.call(
              request.method,
              request.payload,
              sessionId,
            ),
          });
        }
        send(res, 404, { error: 'NOT_FOUND' });
      } finally {
        busy = false;
      }
    })().catch((error: unknown) => {
      if (!res.headersSent)
        send(res, 400, {
          error: error instanceof OaxError ? error.code : 'INVALID_REQUEST',
        });
      else res.end();
    });
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.maxConnections = 16;
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('No loopback listener');
  origin = `http://127.0.0.1:${address.port}`;
  return {
    connection,
    inspectTransport: () => ({ requests, ...transportChecks }),
    origin,
    url: `${origin}/#${bootstrap}`,
    async close() {
      client.dispose();
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
