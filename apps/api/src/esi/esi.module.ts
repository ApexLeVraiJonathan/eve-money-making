import { Module, Logger } from '@nestjs/common';
import { EsiService } from './esi.service';
import { ESI_CLIENT_ADAPTER } from './esi.adapter';
import { PrismaModule } from '../prisma/prisma.module';
import { TokenService } from '../characters/services/token.service';
import { EsiController } from './esi.controller';
import { EsiCharactersService } from './esi-characters.service';

@Module({
  imports: [PrismaModule],
  providers: [
    Logger,
    TokenService,
    EsiService,
    EsiCharactersService,
    { provide: ESI_CLIENT_ADAPTER, useExisting: EsiService },
  ],
  controllers: [EsiController],
  exports: [EsiService, EsiCharactersService],
})
export class EsiModule {}
