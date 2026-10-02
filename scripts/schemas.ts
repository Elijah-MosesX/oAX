import { writeFileSync, mkdirSync } from 'node:fs';
import { format } from 'prettier';
import {
  z,
  messageSchema,
  observationSchema,
  payloadSchemas,
  renamePlanSchema,
  checkPlanSchema,
} from '@oax/protocol';
async function main(): Promise<void> {
  mkdirSync('schemas', { recursive: true });
  for (const [name, schema] of Object.entries({
    'oax.v0.1': messageSchema,
    'spatial.v0.1': observationSchema,
    'rename-plan.v0.1': renamePlanSchema,
    'check-plan.v0.1': checkPlanSchema,
    ...Object.fromEntries(
      Object.entries(payloadSchemas).map(([method, schema]) => [
        `${method}.v0.1`,
        schema,
      ]),
    ),
  })) {
    writeFileSync(
      `schemas/${name}.schema.json`,
      await format(JSON.stringify(z.toJSONSchema(schema)), { parser: 'json' }),
    );
  }
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
