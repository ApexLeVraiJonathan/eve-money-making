import { z } from 'zod';

export const PlanCommitRequestSchema = z
  .object({
    memo: z.string().max(500).optional(),
    request: z.any(),
    result: z.any(),
  })
  .strict();

export type PlanCommitRequest = z.infer<typeof PlanCommitRequestSchema>;
