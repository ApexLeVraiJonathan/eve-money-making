import { Module } from '@nestjs/common';
import { CyclesModule } from './cycles/cycles.module';
import { MarketModule } from './market/market.module';
import { WalletModule } from './wallet/wallet.module';
import { JobsModule } from './jobs/jobs.module';
import { ParameterProfilesModule } from './parameter-profiles/parameter-profiles.module';

/**
 * TradecraftModule
 *
 * Product-level module that groups all arbitrage / ledger domains:
 * - Cycles (ledger, participations, payouts, profit, capital)
 * - Market (arbitrage, pricing, liquidity, packages, tracked stations)
 * - Wallet (imports, transactions, journal)
 * - Jobs (batch operations that primarily serve Tradecraft)
 * - Parameter profiles (trading configuration profiles)
 *
 * This mirrors the character-management and skill-farm product modules and
 * gives us a single import in AppModule for all Tradecraft functionality.
 */
@Module({
  imports: [
    CyclesModule,
    MarketModule,
    WalletModule,
    JobsModule,
    ParameterProfilesModule,
  ],
})
export class TradecraftModule {}
