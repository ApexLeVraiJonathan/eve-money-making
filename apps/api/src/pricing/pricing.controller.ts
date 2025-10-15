import { Body, Controller, Get, Param, Post, UsePipes } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UseGuards } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
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
  // Optional cycle filter (replaces planCommitId)
  cycleId: z.string().uuid().optional(),
});
export type UndercutCheckRequest = z.infer<typeof UndercutCheckSchema>;

export const ConfirmListingSchema = z.object({
  lineId: z.string().uuid(),
  quantity: z.number().int().min(1),
  unitPrice: z.number().positive(),
});
export type ConfirmListingRequest = z.infer<typeof ConfirmListingSchema>;

export const ConfirmRepriceSchema = z.object({
  lineId: z.string().uuid(),
  quantity: z.number().int().min(0),
  newUnitPrice: z.number().positive(),
});
export type ConfirmRepriceRequest = z.infer<typeof ConfirmRepriceSchema>;

export const SellAppraiseByCommitSchema = z.object({
  cycleId: z.string().uuid(),
});
export type SellAppraiseByCommitRequest = z.infer<
  typeof SellAppraiseByCommitSchema
>;

@Controller('pricing')
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Public()
  @Post('sell-appraise')
  @UsePipes(new ZodValidationPipe(SellAppraiseSchema))
  async sellAppraise(@Body() body: SellAppraiseRequest) {
    return this.pricing.sellAppraise(body);
  }

  @Public()
  @Post('undercut-check')
  @UsePipes(new ZodValidationPipe(UndercutCheckSchema))
  async undercutCheck(@Body() body: UndercutCheckRequest) {
    return this.pricing.undercutCheck(body);
  }

  @Post('confirm-listing')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @UsePipes(new ZodValidationPipe(ConfirmListingSchema))
  async confirmListing(@Body() body: ConfirmListingRequest) {
    return this.pricing.confirmListing(body);
  }

  @Post('confirm-reprice')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @UsePipes(new ZodValidationPipe(ConfirmRepriceSchema))
  async confirmReprice(@Body() body: ConfirmRepriceRequest) {
    return this.pricing.confirmReprice(body);
  }

  @Public()
  @Post('sell-appraise-by-commit')
  @UsePipes(new ZodValidationPipe(SellAppraiseByCommitSchema))
  async sellAppraiseByCommit(@Body() body: SellAppraiseByCommitRequest) {
    return this.pricing.sellAppraiseByCommit(body);
  }

  @Public()
  @Get('commit/:id/remaining-lines')
  async getRemainingLines(@Param('id') id: string) {
    return this.pricing.getRemainingLines(id);
  }
}
