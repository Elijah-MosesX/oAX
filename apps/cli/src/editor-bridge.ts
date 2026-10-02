import { randomUUID } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import { RuntimeClient } from '@oax/runtime/client';
import { frames, FrameWriter } from '@oax/runtime/transport';
import {
  OaxError,
  VERSION,
  payloadSchemas,
  responseSchema,
  validateRequest,
  type Request,
  EDITOR_READ_METHODS,
  editorBootstrapSchema,
} from '@oax/protocol';

export const EDITOR_METHODS = EDITOR_READ_METHODS;
/** Private parent-owned stdio only. No provider, mutation or terminal capability. */
export async function editorBridge(
  runtimePath: string,
  root: string,
): Promise<void> {
  const client = await RuntimeClient.connect(runtimePath, await realpath(root));
  const writer = new FrameWriter(process.stdout);
  let active: Request | undefined;
  const seen = new Set<string>();
  const opened = (await client.call('session.open', {})) as {
    sessionId: string;
  };
  const send = (correlationId: string, payload: unknown, error?: OaxError) =>
    writer.send(
      responseSchema.parse({
        type: 'response',
        version: VERSION,
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        workspaceId: client.identity,
        correlationId,
        ...(error
          ? { ok: false, error: { code: error.code, message: error.message } }
          : { ok: true, payload }),
      }),
    );
  const unsubscribe = client.subscribe((event) => {
    if (active && event.sessionId === opened.sessionId)
      void writer
        .send({ ...event, correlationId: active.id })
        .catch(() => client.dispose());
  });
  const disconnected = client.onDisconnect(() => process.stdin.destroy());
  const operations = new Set<Promise<void>>();
  try {
    await send(
      'adapter-bootstrap',
      editorBootstrapSchema.parse({
        contract: 'editor-read-only.v1',
        workspaceId: client.identity,
        sessionId: opened.sessionId,
        methods: EDITOR_METHODS,
        engine: 'mock',
      }),
    );
    for await (const input of frames(process.stdin)) {
      const req = validateRequest(input);
      try {
        if (
          req.workspaceId !== client.identity ||
          req.sessionId !== opened.sessionId
        )
          throw new OaxError('SCOPE_MISMATCH', 'Adapter identity mismatch');
        if (seen.has(req.id))
          throw new OaxError('DUPLICATE_REQUEST', 'Request ID already used');
        if (seen.size >= 4096)
          throw new OaxError('SESSION_LIMIT', 'Reconnect after 4096 requests');
        seen.add(req.id);
        if (
          !EDITOR_METHODS.includes(
            req.method as (typeof EDITOR_METHODS)[number],
          )
        )
          throw new OaxError(
            'UNSUPPORTED_METHOD',
            'Method unavailable in read-only editor adapter',
          );
        const payload = payloadSchemas[
          req.method as keyof typeof payloadSchemas
        ].parse(req.payload);
        if (req.method === 'task.cancel') {
          await send(
            req.id,
            await client.call(req.method, payload, opened.sessionId),
          );
          continue;
        }
        if (active)
          throw new OaxError(
            'BUSY',
            'One operation at a time; cancellation remains available',
          );
        active = req;
        const operation = (async () => {
          try {
            const result =
              req.method === 'selection.explain'
                ? await client.explain(
                    opened.sessionId,
                    payloadSchemas['selection.explain'].parse(req.payload)
                      .observation,
                    payloadSchemas['selection.explain'].parse(req.payload)
                      .objective,
                  )
                : await client.call(req.method, payload, opened.sessionId);
            await send(req.id, result);
          } catch (error) {
            await send(
              req.id,
              undefined,
              error instanceof OaxError
                ? error
                : new OaxError('OPERATION_FAILED', 'Adapter operation failed'),
            );
          } finally {
            active = undefined;
          }
        })();
        operations.add(operation);
        void operation
          .finally(() => operations.delete(operation))
          .catch(() => client.dispose());
      } catch (error) {
        await send(
          req.id,
          undefined,
          error instanceof OaxError
            ? error
            : new OaxError('INVALID_PARAMS', 'Invalid adapter parameters'),
        );
      }
    }
  } finally {
    client.dispose();
    await Promise.allSettled(operations);
    unsubscribe();
    disconnected();
    await writer.flush();
  }
}
