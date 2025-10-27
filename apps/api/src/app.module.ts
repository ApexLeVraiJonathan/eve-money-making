import {
  Module,
  Logger,
  MiddlewareConsumer,
  Controller,
  Get,
} from '@nestjs/common';
import { ImportModule } from './import/import.module';
import { PrismaModule } from './prisma/prisma.module';
import { DataImportModule } from '@shared/data-import';
import { TrackedStationsModule } from './tracked-stations/tracked-stations.module';
import { LiquidityModule } from './liquidity/liquidity.module';
import { ArbitrageModule } from './arbitrage/arbitrage.module';
import { EsiModule } from './esi/esi.module';
import { JobsModule } from './jobs/jobs.module';
import { RequestIdMiddleware } from './common/request-id.middleware';
import { AuthModule } from './auth/auth.module';
import { LedgerModule } from './ledger/ledger.module';
import { ReconciliationModule } from './reconciliation/reconciliation.module';
import { WalletModule } from './wallet/wallet.module';
import { PricingModule } from './pricing/pricing.module';
import { UsersModule } from './users/users.module';
import { PackagesModule } from './packages/packages.module';

@Controller('health')
class HealthController {
  @Get()
  ping() {
    return { ok: true };
  }
}

@Module({
  imports: [
    ImportModule,
    PrismaModule,
    DataImportModule,
    TrackedStationsModule,
    LiquidityModule,
    ArbitrageModule,
    EsiModule,
    JobsModule,
    AuthModule,
    LedgerModule,
    ReconciliationModule,
    WalletModule,
    PricingModule,
    UsersModule,
    PackagesModule,
  ],
  controllers: [HealthController],
  providers: [Logger],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
