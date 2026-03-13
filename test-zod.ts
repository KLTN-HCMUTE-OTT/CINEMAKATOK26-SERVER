import { z } from 'zod';

const schema = z.object({
  BOOL: z.coerce.boolean(),
});

console.log('Coercing "true":', schema.safeParse({ BOOL: 'true' }).data);
console.log('Coercing "false":', schema.safeParse({ BOOL: 'false' }).data);
console.log('Coercing "1":', schema.safeParse({ BOOL: '1' }).data);
console.log('Coercing "0":', schema.safeParse({ BOOL: '0' }).data);
console.log('Coercing "":', schema.safeParse({ BOOL: '' }).data);
