import {
  Module,
  Logger,
  MiddlewareConsumer,
  Controller,
  Get,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
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
import { SupportModule } from './support/support.module';
import { CompositeAuthGuard } from './characters/guards/composite-auth.guard';
import { Public } from './characters/decorators/public.decorator';

@Controller('health')
class HealthController {
  @Public() // Health check should remain public for monitoring
  @Get()
  ping() {
    return { ok: true };
  }
}

@Module({
  imports: [
    // Rate limiting: 100 requests per minute per IP
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 seconds
        limit: 100, // 100 requests
      },
    ]),
    PrismaModule,
    DataImportModule,
    EsiModule,
    JobsModule,
    CharactersModule,
    CyclesModule,
    WalletModule,
    GameDataModule,
    MarketModule,
    SupportModule,
  ],
  controllers: [HealthController],
  providers: [
    Logger,
    {
      provide: APP_GUARD,
      useClass: CompositeAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
