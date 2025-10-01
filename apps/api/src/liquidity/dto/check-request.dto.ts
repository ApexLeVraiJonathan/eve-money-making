import { z } from 'zod';

/**
 * Request schema for POST /liquidity/check
 */
export const LiquidityCheckRequestSchema = z
  .object({
    station_id: z.coerce.number().int().positive().optional(),
    windowDays: z.coerce.number().int().min(1).max(30).optional(),
    minCoverageRatio: z.coerce.number().min(0).max(1).optional(),
    minLiquidityThresholdISK: z.coerce.number().min(0).optional(),
  })
  .strict();

export type LiquidityCheckRequest = z.infer<typeof LiquidityCheckRequestSchema>;
