import { writeFileSync, mkdirSync } from 'node:fs';
import { z, messageSchema, observationSchema } from '@oax/protocol';
mkdirSync('schemas', { recursive: true });
for (const [name, schema] of Object.entries({
  'oax.v0.1': messageSchema,
  'spatial.v0.1': observationSchema,
})) {
  writeFileSync(
    `schemas/${name}.schema.json`,
    JSON.stringify(z.toJSONSchema(schema), null, 2) + '\n',
  );
}
