import { z } from 'zod';
export { z };
/** The same zero-based coordinate contract, usable without Node transport APIs. */
export const positionSchema = z.strictObject({
  line: z.number().int().min(0),
  column: z.number().int().min(0),
});
export const rangeSchema = z.strictObject({
  start: positionSchema,
  end: positionSchema,
});
