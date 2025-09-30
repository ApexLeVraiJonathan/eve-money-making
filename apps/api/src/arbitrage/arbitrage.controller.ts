import { Body, Controller, Post } from '@nestjs/common';
import type { PlanResult } from '../../libs/arbitrage-packager/src/interfaces/packager.interfaces';
import { ArbitrageService } from './arbitrage.service';

@Controller('arbitrage')
export class ArbitrageController {
  constructor(private readonly arbitrageService: ArbitrageService) {}

  @Post('check')
  async check(
    @Body()
    body?: {
      sourceStationId?: number; // defaults to 60003760 (Jita 4-4)
      arbitrageMultiplier?: number; // defaults to 5
      marginValidateThreshold?: number; // defaults to 50
      minTotalProfitISK?: number; // defaults to 1_000_000
      stationConcurrency?: number; // defaults to 4
      itemConcurrency?: number; // defaults to 12
      salesTaxPercent?: number; // defaults to 3.37
      brokerFeePercent?: number; // defaults to 1.5
      esiMaxConcurrency?: number; // optional: overrides ESI client concurrency
    },
  ) {
    return this.arbitrageService.check(body);
  }

  @Post('plan-packages')
  async planPackages(
    @Body()
    body: {
      shippingCostByStation: Record<number, number>;
      packageCapacityM3: number;
      investmentISK: number;
      perDestinationMaxBudgetSharePerItem?: number;
      maxPackagesHint?: number;
      destinationCaps?: Record<number, { maxShare?: number; maxISK?: number }>;
      allocation?: {
        mode?: 'best' | 'targetWeighted' | 'roundRobin';
        targets?: Record<number, number>;
        spreadBias?: number;
      };
    },
  ): Promise<PlanResult> {
    return await this.arbitrageService.planPackages(body);
  }
}
