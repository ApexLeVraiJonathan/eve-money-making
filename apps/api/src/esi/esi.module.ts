import { Module, Logger } from '@nestjs/common';
import { EsiService } from './esi.service';
import { PrismaModule } from '../prisma/prisma.module';
import { TokenService } from '../auth/token.service';
import { EsiController } from './esi.controller';
import { EsiCharactersService } from './esi-characters.service';

@Module({
  imports: [PrismaModule],
  providers: [Logger, TokenService, EsiService, EsiCharactersService],
  controllers: [EsiController],
  exports: [EsiService, EsiCharactersService],
})
export class EsiModule {}
