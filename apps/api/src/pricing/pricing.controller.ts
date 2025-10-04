import { Body, Controller, Post, UsePipes } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { z } from 'zod';

export const SellAppraiseSchema = z.object({
  destinationStationId: z.number().int().positive(),
  lines: z.array(z.string()).min(1),
});
export type SellAppraiseRequest = z.infer<typeof SellAppraiseSchema>;

export const UndercutCheckSchema = z.object({
  // If provided, limit to these character IDs; otherwise use all linked
  characterIds: z.array(z.number().int().positive()).optional(),
  // If provided, limit to these station IDs; otherwise use tracked stations
  stationIds: z.array(z.number().int().positive()).optional(),
});
export type UndercutCheckRequest = z.infer<typeof UndercutCheckSchema>;

@Controller('pricing')
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Post('sell-appraise')
  @UsePipes(new ZodValidationPipe(SellAppraiseSchema))
  async sellAppraise(@Body() body: SellAppraiseRequest) {
    return this.pricing.sellAppraise(body);
  }

  @Post('undercut-check')
  @UsePipes(new ZodValidationPipe(UndercutCheckSchema))
  async undercutCheck(@Body() body: UndercutCheckRequest) {
    return this.pricing.undercutCheck(body);
  }
}
