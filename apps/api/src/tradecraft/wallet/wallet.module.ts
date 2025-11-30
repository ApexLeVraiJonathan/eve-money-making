import { Module, Logger, forwardRef } from '@nestjs/common';
import { PrismaModule } from '@api/prisma/prisma.module';
import { EsiModule } from '@api/esi/esi.module';
import { WalletService } from './services/wallet.service';
import { WalletController } from './wallet.controller';
import { AllocationService } from './services/allocation.service';
import { ReconciliationController } from './reconciliation.controller';
import { GameDataModule } from '@api/game-data/game-data.module';
import { CharactersModule } from '@api/characters/characters.module';

@Module({
  imports: [
    PrismaModule,
    EsiModule,
    forwardRef(() => GameDataModule),
    CharactersModule,
  ],
  providers: [WalletService, AllocationService, Logger],
  controllers: [WalletController, ReconciliationController],
  exports: [WalletService, AllocationService],
})
export class WalletModule {}
