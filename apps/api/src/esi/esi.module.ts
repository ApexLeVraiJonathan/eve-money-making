import { Module, Logger } from '@nestjs/common';
import { EsiService } from './esi.service';
import { PrismaModule } from '../prisma/prisma.module';
import { TokenService } from '../auth/token.service';

@Module({
  imports: [PrismaModule],
  providers: [Logger, TokenService, EsiService],
  exports: [EsiService],
})
export class EsiModule {}
