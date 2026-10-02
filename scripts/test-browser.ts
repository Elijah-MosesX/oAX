import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { BrowserInspector, browserAction } from '@oax/browser';
import { PermissionEngine } from '@oax/permissions';
async function main(): Promise<void> {
  let outsideRequests = 0;
  const outside = createServer((_req, response) => {
    outsideRequests++;
    response.end('outside origin');
  });
  await new Promise<void>((resolve) => outside.listen(0, '127.0.0.1', resolve));
  const outsideAddress = outside.address();
  assert.ok(outsideAddress && typeof outsideAddress !== 'string');
  const outsideOrigin = `http://127.0.0.1:${outsideAddress.port}`;
  const server = createServer((request, response) => {
    if (request.url === '/redirect') {
      response.writeHead(302, { Location: outsideOrigin + '/blocked' });
      response.end();
      return;
    }
    if (request.url === '/network-probe') {
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.end(
        `<title>oAX network probe</title><img src="${outsideOrigin}/blocked">`,
      );
      return;
    }
    response.writeHead(200, {
      'Content-Type': 'text/html',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    });
    response.end(
      '<!doctype html><title>oAX fixture</title><h1>oAX browser verification</h1>',
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  const installation = JSON.parse(
    await readFile('.oax/browser-install.json', 'utf8'),
  ) as { executable: string };
  const permissions = new PermissionEngine();
  const scope = {
    principal: 'fixture',
    workspaceId: 'workspace',
    sessionId: 'browser',
    taskId: 'browser-fixture',
  };
  const inspector = new BrowserInspector({
    serverEntry: path.resolve(
      'node_modules/chrome-devtools-mcp/build/src/bin/chrome-devtools-mcp.js',
    ),
    chromeExecutable: installation.executable,
    origin,
    permissions,
    scope,
  });
  try {
    await inspector.connect();
    await assert.rejects(
      inspector.call('new_page', { url: origin + '/fixture' }),
    );
    permissions.grant({
      ...browserAction(scope, origin, 'new_page', { url: origin + '/fixture' }),
      id: 'navigate',
      decision: 'allow',
      expiresAt: Date.now() + 60000,
    });
    const opened = (await inspector.call('new_page', {
      url: origin + '/fixture',
    })) as { pageId: number };
    const pageId = opened.pageId;
    permissions.grant({
      ...browserAction(scope, origin, 'take_snapshot', { pageId }),
      id: 'snapshot',
      decision: 'allow',
      expiresAt: Date.now() + 60000,
    });
    const snapshot = await inspector.call('take_snapshot', { pageId });
    assert.match(JSON.stringify(snapshot), /oAX browser verification/);
    await assert.rejects(
      inspector.call('new_page', { url: 'https://example.com' }),
    );
    await assert.rejects(
      inspector.call('take_snapshot', { filePath: 'outside.txt' }),
    );
    for (const resource of ['/network-probe', '/redirect']) {
      const args = { url: origin + resource };
      permissions.grant({
        ...browserAction(scope, origin, 'new_page', args),
        id: resource,
        decision: 'allow',
        expiresAt: Date.now() + 60000,
      });
      if (resource === '/redirect')
        await assert.rejects(inspector.call('new_page', args));
      else await inspector.call('new_page', args);
    }
    assert.equal(
      outsideRequests,
      0,
      'Origin restriction must block redirects and subresource requests before they reach the other origin',
    );
    console.log(
      'Dedicated Chrome -> pinned DevTools MCP -> scoped snapshot passed; missing grants, other origins, and file output denied. Telemetry/CrUX/update checks disabled.',
    );
  } finally {
    await inspector.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await new Promise<void>((resolve) => outside.close(() => resolve()));
  }
}
void main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Browser test failed');
  process.exitCode = 1;
});
