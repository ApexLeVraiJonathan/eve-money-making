import { z } from 'zod';

/**
 * Request schema for POST /arbitrage/check
 *
 * Notes for learning:
 * - z.coerce.number() tries to convert strings to numbers from JSON safely.
 * - We validate ranges to catch accidental negatives or unreasonable values.
 */
export const ArbitrageCheckRequestSchema = z
  .object({
    sourceStationId: z.coerce.number().int().positive().optional(),
    arbitrageMultiplier: z.coerce.number().min(1).max(50).optional(),
    marginValidateThreshold: z.coerce.number().min(0).max(1000).optional(),
    minTotalProfitISK: z.coerce.number().min(0).optional(),
    stationConcurrency: z.coerce.number().int().min(1).max(32).optional(),
    itemConcurrency: z.coerce.number().int().min(1).max(200).optional(),
    salesTaxPercent: z.coerce.number().min(0).max(100).optional(),
    brokerFeePercent: z.coerce.number().min(0).max(100).optional(),
    esiMaxConcurrency: z.coerce.number().int().min(1).max(400).optional(),
  })
  .strict();

export type ArbitrageCheckRequest = z.infer<typeof ArbitrageCheckRequestSchema>;
