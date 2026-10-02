import { z, OaxError } from '@oax/protocol';
import { jevPageSchema, type JevPage } from './jev.js';
/** Conservative accessibility projection. These are proposals, never executable selectors. */
export function snapshotPage(evidence: unknown, expectedUrl: string): JevPage {
  const blocks = z
    .object({
      content: z
        .array(
          z.object({ type: z.literal('text'), text: z.string().max(65536) }),
        )
        .max(20),
    })
    .parse(evidence);
  const text = blocks.content.map((block) => block.text).join('\n');
  const root = text.match(
    /RootWebArea "((?:[^"\\]|\\.)*)" url="((?:[^"\\]|\\.)*)"/,
  );
  if (!root || root[2] !== expectedUrl)
    throw new OaxError(
      'BROWSER_SNAPSHOT',
      'Snapshot URL must match the inspected page',
    );
  const actions: JevPage['actions'] = [];
  for (const line of text.split('\n')) {
    const match = line.match(
      /^\s*uid=([\w.-]+) (button|link|textbox|searchbox|checkbox|radio) ("(?:[^"\\]|\\.)*")/,
    );
    if (!match || /\b(disabled|readonly)\b/.test(line)) continue;
    const [, node, role, quoted] = match;
    const label = JSON.parse(quoted!) as string;
    actions.push({
      id: node!,
      node: node!,
      role: role!,
      label: label.slice(0, 2000),
      kind: ['textbox', 'searchbox'].includes(role!) ? 'fill' : 'click',
    });
    if (actions.length === 200) break;
  }
  return jevPageSchema.parse({
    url: expectedUrl,
    title: JSON.parse(`"${root[1]}"`),
    text: text.slice(0, 16000),
    actions,
  });
}
