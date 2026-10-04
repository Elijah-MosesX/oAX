import { Denied, bounded } from './domain.js';
export function visionInput(body: Record<string, unknown>) {
  if (body.approved !== true)
    throw new Denied(403, 'Review the image and authorize this analysis first');
  const data = bounded(body.image, 'image', 512000);
  if (!/^\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(data))
    throw new Denied(400, 'Use a prepared JPEG snapshot');
  const question = bounded(body.question, 'question', 1000);
  return { data, question };
}
export function visionOutput(value: unknown) {
  if (!value || typeof value !== 'object')
    throw new Denied(502, 'Visual analysis was malformed');
  const record = value as Record<string, unknown>;
  const items = (key: string) => {
    if (!Array.isArray(record[key]) || record[key].length > 8)
      throw new Denied(502, 'Visual analysis exceeded its contract');
    return record[key].map((item) => bounded(item, key, 1200));
  };
  return {
    summary: bounded(record.summary, 'summary', 2000),
    observations: items('observations'),
    suggestions: items('suggestions'),
    uncertainty: bounded(record.uncertainty, 'uncertainty', 1600),
  };
}
