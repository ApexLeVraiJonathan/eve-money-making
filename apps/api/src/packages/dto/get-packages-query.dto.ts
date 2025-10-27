import { z } from 'zod';

export const GetPackagesQuerySchema = z
  .object({
    cycleId: z.string().uuid(),
    status: z.enum(['active', 'failed', 'completed']).optional(),
  })
  .strict();

export type GetPackagesQuery = z.infer<typeof GetPackagesQuerySchema>;

