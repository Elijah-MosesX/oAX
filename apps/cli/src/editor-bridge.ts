import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import type { Readable, Writable } from 'node:stream';
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
  editorAgentBootstrapSchema,
} from '@oax/protocol';

export const EDITOR_METHODS = EDITOR_READ_METHODS;
/** Private parent-owned stdio. Codex is explicit opt-in; writes remain unavailable. */
export async function editorBridge(
  runtimePath: string,
  root: string,
  codex?: string,
): Promise<void> {
  if (codex !== undefined && !path.isAbsolute(codex))
    throw new OaxError('INVALID_ARGS', 'Codex executable must be absolute');
  const client = await RuntimeClient.connect(
    runtimePath,
    await realpath(root),
    process.execPath,
    codex,
  );
  try {
    await serveEditorBridge(
      client,
      codex ? 'codex' : 'mock',
      process.stdin,
      process.stdout,
    );
  } finally {
    client.dispose();
  }
}
export async function serveEditorBridge(
  client: Pick<
    RuntimeClient,
    'identity' | 'call' | 'explain' | 'subscribe' | 'onDisconnect' | 'dispose'
  >,
  engine: 'mock' | 'codex',
  inputStream: Readable,
  outputStream: Writable,
  now: () => number = Date.now,
): Promise<void> {
  const writer = new FrameWriter(outputStream);
  let preview:
    | { hash: string; requestHash: string; expires: number }
    | undefined;
  const fingerprint = (value: unknown) =>
    createHash('sha256').update(JSON.stringify(value)).digest('hex');
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
  const disconnected = client.onDisconnect(() => inputStream.destroy());
  const operations = new Set<Promise<void>>();
  try {
    await send(
      'adapter-bootstrap',
      (engine === 'codex'
        ? editorAgentBootstrapSchema
        : editorBootstrapSchema
      ).parse({
        contract:
          engine === 'codex' ? 'editor-codex-text.v1' : 'editor-read-only.v1',
        workspaceId: client.identity,
        sessionId: opened.sessionId,
        methods: EDITOR_METHODS,
        engine,
      }),
    );
    for await (const input of frames(inputStream)) {
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
            let result: unknown;
            if (req.method === 'selection.explain') {
              const { approvedContextHash, ...selection } =
                payloadSchemas['selection.explain'].parse(payload);
              if (engine === 'codex') {
                const receipt = preview;
                preview = undefined;
                if (
                  !receipt ||
                  now() >= receipt.expires ||
                  receipt.hash !== approvedContextHash ||
                  receipt.requestHash !== fingerprint(selection)
                )
                  throw new OaxError(
                    'PERMISSION_DENIED',
                    'Preview and approve this exact context in this connection before transmission',
                  );
              }
              result = await client.explain(
                opened.sessionId,
                selection.observation,
                selection.objective,
                undefined,
                approvedContextHash,
                selection.history,
                selection.memoryIds,
              );
            } else {
              if (req.method === 'context.preview') preview = undefined;
              result = await client.call(req.method, payload, opened.sessionId);
              if (engine === 'codex' && req.method === 'context.preview') {
                const hash = (result as { hash?: unknown })?.hash;
                if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash))
                  throw new OaxError(
                    'INVALID_MESSAGE',
                    'Runtime returned an invalid context hash',
                  );
                preview = {
                  hash,
                  requestHash: fingerprint(payload),
                  expires: now() + 60000,
                };
              }
            }
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
