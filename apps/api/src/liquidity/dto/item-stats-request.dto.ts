import { z } from 'zod';

export const LiquidityItemStatsRequestSchema = z
  .object({
    itemId: z.coerce.number().int().positive().optional(),
    itemName: z.string().min(1).optional(),
    stationId: z.coerce.number().int().positive().optional(),
    stationName: z.string().min(1).optional(),
    isBuyOrder: z.coerce.boolean().optional(),
    windowDays: z.coerce.number().int().min(1).max(30).optional(),
  })
  .refine(
    (v) => Boolean(v.itemId) || Boolean(v.itemName),
    'Provide either itemId or itemName',
  )
  .strict();

export type LiquidityItemStatsRequest = z.infer<
  typeof LiquidityItemStatsRequestSchema
>;
