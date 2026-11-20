import { z } from 'zod';

export const fileParams = z.object({ storageKey: z.string().regex(/^(?:[0-9a-f-]{36}|[0-9a-f-]{36}\.(?:pdf|jpg|png|webp))$/i) }).strict();
