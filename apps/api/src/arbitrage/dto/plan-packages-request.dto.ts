import { z } from 'zod';

/**
 * Request schema for POST /arbitrage/plan-packages
 *
 * Learning note:
 * - We validate object shapes and numeric ranges to keep planner safe.
 * - Keys in shippingCostByStation are numbers (station IDs).
 */
export const PlanPackagesRequestSchema = z
  .object({
    shippingCostByStation: z.record(z.string(), z.coerce.number().min(0)),
    packageCapacityM3: z.coerce.number().positive(),
    investmentISK: z.coerce.number().positive(),
    perDestinationMaxBudgetSharePerItem: z.coerce
      .number()
      .min(0)
      .max(1)
      .optional(),
    maxPackagesHint: z.coerce.number().int().min(1).max(200).optional(),
    maxPackageCollateralISK: z.coerce.number().positive().optional(),
    destinationCaps: z
      .record(
        z.string(),
        z.object({
          maxShare: z.coerce.number().min(0).max(1).optional(),
          maxISK: z.coerce.number().min(0).optional(),
        }),
      )
      .optional(),
    allocation: z
      .object({
        mode: z.enum(['best', 'targetWeighted', 'roundRobin']).optional(),
        targets: z
          .record(z.string(), z.coerce.number().min(0).max(1))
          .optional(),
        spreadBias: z.coerce.number().min(0).max(1).optional(),
      })
      .optional(),
    liquidityWindowDays: z.coerce.number().int().min(1).max(90).optional(),
  })
  .strict();

export type PlanPackagesRequest = z.infer<typeof PlanPackagesRequestSchema>;
