import {
  Module,
  Logger,
  MiddlewareConsumer,
  Controller,
  Get,
} from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { DataImportModule } from '@shared/data-import';
import { EsiModule } from './esi/esi.module';
import { JobsModule } from './jobs/jobs.module';
import { RequestIdMiddleware } from './common/request-id.middleware';
import { CharactersModule } from './characters/characters.module';
import { CyclesModule } from './cycles/cycles.module';
import { WalletModule } from './wallet/wallet.module';
import { GameDataModule } from './game-data/game-data.module';
import { MarketModule } from './market/market.module';

@Controller('health')
class HealthController {
  @Get()
  ping() {
    return { ok: true };
  }
}

@Module({
  imports: [
    PrismaModule,
    DataImportModule,
    EsiModule,
    JobsModule,
    CharactersModule,
    CyclesModule,
    WalletModule,
    GameDataModule,
    MarketModule,
  ],
  controllers: [HealthController],
  providers: [Logger],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
