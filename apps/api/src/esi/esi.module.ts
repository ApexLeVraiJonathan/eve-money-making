import { Module, Logger } from '@nestjs/common';
import { EsiService } from './esi.service';

@Module({
  providers: [Logger, EsiService],
  exports: [EsiService],
})
export class EsiModule {}
