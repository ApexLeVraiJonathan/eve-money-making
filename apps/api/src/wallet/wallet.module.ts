import { Module, Logger, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EsiModule } from '../esi/esi.module';
import { WalletService } from './services/wallet.service';
import { WalletController } from './wallet.controller';
import { AllocationService } from './services/allocation.service';
import { ReconciliationController } from './reconciliation.controller';
import { GameDataModule } from '../game-data/game-data.module';
import { CharactersModule } from '../characters/characters.module';

@Module({
  imports: [PrismaModule, EsiModule, forwardRef(() => GameDataModule), CharactersModule],
  providers: [WalletService, AllocationService, Logger],
  controllers: [WalletController, ReconciliationController],
  exports: [WalletService, AllocationService],
})
export class WalletModule {}
