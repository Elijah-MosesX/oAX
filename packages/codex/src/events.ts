import { OaxError } from '@oax/protocol';
import type { ProviderNotification } from './rpc.js';
export interface ProviderActivity {
  kind: 'turn' | 'message' | 'tool';
  state: 'started' | 'completed' | 'failed' | 'cancelled' | 'denied';
}
/** Public activity metadata only: no arguments, output, credentials or reasoning. */
export function activity(
  event: ProviderNotification,
): ProviderActivity | undefined {
  if (event.method === 'oax/serverRequestDenied')
    return { kind: 'tool', state: 'denied' };
  if (event.method === 'turn/started')
    return { kind: 'turn', state: 'started' };
  if (event.method === 'turn/completed') {
    const turn = event.params.turn as { status?: unknown } | undefined;
    const state =
      turn?.status === 'completed'
        ? 'completed'
        : turn?.status === 'failed'
          ? 'failed'
          : turn?.status === 'interrupted'
            ? 'cancelled'
            : undefined;
    if (!state)
      throw new OaxError('PROVIDER_PROTOCOL', 'Invalid provider turn status');
    return { kind: 'turn', state };
  }
  if (event.method === 'item/started' || event.method === 'item/completed') {
    const item = event.params.item as { type?: unknown } | undefined;
    if (!item || typeof item.type !== 'string')
      throw new OaxError('PROVIDER_PROTOCOL', 'Invalid provider item');
    if (item.type === 'agentMessage')
      return {
        kind: 'message',
        state: event.method === 'item/started' ? 'started' : 'completed',
      };
    if (['userMessage', 'reasoning', 'plan'].includes(item.type)) return;
    return { kind: 'tool', state: 'denied' };
  }
}
