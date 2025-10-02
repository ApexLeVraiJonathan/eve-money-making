import { Controller, Get } from '@nestjs/common';
import { EsiService } from './esi.service';

@Controller('esi')
export class EsiController {
  constructor(private readonly esi: EsiService) {}

  @Get('metrics')
  metrics() {
    return this.esi.getMetricsSnapshot();
  }
}
