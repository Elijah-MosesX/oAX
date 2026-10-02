import { OaxError, type Observation } from '@oax/protocol';
export class SpatialStore {
  private latest = new Map<string, Observation>();
  update(sessionId: string, observation: Observation): void {
    const key = `${sessionId}:${observation.path}`;
    const previous = this.latest.get(key);
    if (!previous && this.latest.size >= 512)
      throw new OaxError(
        'SPATIAL_LIMIT',
        'Snapshot limit reached; close session to release state',
      );
    if (
      previous &&
      (previous.documentVersion > observation.documentVersion ||
        (previous.documentVersion === observation.documentVersion &&
          previous.text !== observation.text))
    )
      throw new OaxError('STALE_DOCUMENT', 'Recapture the document snapshot');
    this.latest.set(key, structuredClone(observation));
  }
  close(sessionId: string): void {
    for (const key of this.latest.keys())
      if (key.startsWith(`${sessionId}:`)) this.latest.delete(key);
  }
}
