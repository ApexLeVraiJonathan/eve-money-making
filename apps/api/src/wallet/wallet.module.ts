import { Module, Logger } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EsiModule } from '../esi/esi.module';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { GameDataModule } from '../game-data/game-data.module';
import { CharacterModule } from '../characters/character.module';

@Module({
  imports: [PrismaModule, EsiModule, GameDataModule, CharacterModule],
  providers: [WalletService, Logger],
  controllers: [WalletController],
  exports: [WalletService],
})
export class WalletModule {}
