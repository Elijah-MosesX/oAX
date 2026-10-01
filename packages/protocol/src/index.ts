import { randomUUID } from 'node:crypto';
import { z } from 'zod';
export { z };
export const VERSION = '0.1' as const;
export const MAX_FRAME_BYTES = 262_144;
export const CAPABILITIES = [
  'spatial.snapshot.v1',
  'agent.mock.explain.v1',
  'agent.events.v1',
  'task.cancel.v1',
] as const;
const id = z.string().min(1).max(128);
export const positionSchema = z.strictObject({
  line: z.number().int().min(0),
  column: z.number().int().min(0),
});
export const rangeSchema = z.strictObject({
  start: positionSchema,
  end: positionSchema,
});
export const observationSchema = z.strictObject({
  path: z.string().min(1).max(4096),
  uri: z.string().max(8192),
  documentVersion: z.number().int().min(1),
  dirty: z.boolean(),
  text: z.string().max(131_072),
  cursor: positionSchema,
  selection: rangeSchema,
  visibleRanges: z.array(rangeSchema).max(100),
  openFiles: z.array(z.string().max(4096)).max(100),
});
export type Position = z.infer<typeof positionSchema>;
export type TextRange = z.infer<typeof rangeSchema>;
export type Observation = z.infer<typeof observationSchema>;
const envelope = {
  id,
  version: z.literal(VERSION),
  timestamp: z.iso.datetime(),
  workspaceId: id,
};
export const requestSchema = z.strictObject({
  ...envelope,
  type: z.literal('request'),
  method: z.string().min(1).max(128),
  sessionId: id.optional(),
  payload: z.unknown(),
});
export const errorSchema = z.strictObject({
  code: z.string().max(64),
  message: z.string().max(1024),
});
export const responseSchema = z.union([
  z.strictObject({
    ...envelope,
    type: z.literal('response'),
    correlationId: id,
    ok: z.literal(true),
    payload: z.unknown(),
  }),
  z.strictObject({
    ...envelope,
    type: z.literal('response'),
    correlationId: id,
    ok: z.literal(false),
    error: errorSchema,
  }),
]);
export const taskStates = [
  'created',
  'gathering_context',
  'planning',
  'executing',
  'verifying',
  'completed',
  'failed',
  'cancelled',
] as const;
export type TaskState = (typeof taskStates)[number];
const eventBase = {
  ...envelope,
  type: z.literal('event'),
  correlationId: id,
  sessionId: id,
  taskId: id,
  sequence: z.number().int().min(1),
};
export const eventSchema = z.union([
  z.strictObject({
    ...eventBase,
    method: z.literal('task.state'),
    payload: z.strictObject({
      state: z.enum(taskStates),
      error: errorSchema.optional(),
    }),
  }),
  z.strictObject({
    ...eventBase,
    method: z.literal('agent.delta'),
    payload: z.strictObject({ text: z.string().max(16_384) }),
  }),
]);
export const messageSchema = z.union([
  requestSchema,
  responseSchema,
  eventSchema,
]);
export const payloadSchemas = {
  initialize: z.strictObject({
    token: z.string().min(32).max(128),
    capabilities: z.array(z.string().max(128)).max(32),
  }),
  'session.open': z.strictObject({}),
  'selection.explain': z.strictObject({
    observation: observationSchema,
    objective: z.string().min(1).max(2048),
  }),
  'task.cancel': z.strictObject({ taskId: id }),
  'session.close': z.strictObject({}),
};
export type Request = z.infer<typeof requestSchema>;
export type Response = z.infer<typeof responseSchema>;
export type Event = z.infer<typeof eventSchema>;
export function request(
  workspaceId: string,
  method: string,
  payload: unknown,
  sessionId?: string,
): Request {
  return {
    id: randomUUID(),
    version: VERSION,
    timestamp: new Date().toISOString(),
    type: 'request',
    workspaceId,
    method,
    payload,
    ...(sessionId ? { sessionId } : {}),
  };
}
export class OaxError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export function validateRequest(input: unknown): Request {
  if (
    input &&
    typeof input === 'object' &&
    'version' in input &&
    input.version !== VERSION
  )
    throw new OaxError(
      'UNSUPPORTED_VERSION',
      'Supported protocol version: 0.1',
    );
  const result = requestSchema.safeParse(input);
  if (!result.success)
    throw new OaxError('INVALID_MESSAGE', 'Invalid request envelope');
  if (Buffer.byteLength(JSON.stringify(input)) > MAX_FRAME_BYTES)
    throw new OaxError('PAYLOAD_LIMIT', 'Request exceeds frame limit');
  return result.data;
}
