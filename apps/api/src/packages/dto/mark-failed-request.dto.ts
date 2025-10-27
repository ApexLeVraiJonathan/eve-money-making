import { z } from 'zod';

export const MarkFailedRequestSchema = z
  .object({
    collateralRecoveredIsk: z.string().regex(/^\d+(\.\d{1,2})?$/),
    collateralProfitIsk: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/)
      .optional()
      .default('0'),
    memo: z.string().max(500).optional(),
  })
  .strict();

export type MarkFailedRequest = z.infer<typeof MarkFailedRequestSchema>;
