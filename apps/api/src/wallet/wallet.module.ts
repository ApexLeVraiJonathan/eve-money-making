import { Module, Logger } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EsiModule } from '../esi/esi.module';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';

@Module({
  imports: [PrismaModule, EsiModule],
  providers: [WalletService, Logger],
  controllers: [WalletController],
  exports: [WalletService],
})
export class WalletModule {}
