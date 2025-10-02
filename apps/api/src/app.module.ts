import { Module, Logger, MiddlewareConsumer } from '@nestjs/common';
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
  ],
  controllers: [],
  providers: [Logger],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
