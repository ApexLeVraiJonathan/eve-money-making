import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { EsiService } from './esi.service';

@Controller('esi')
export class EsiController {
  constructor(private readonly esi: EsiService) {}

  @Public()
  @Get('metrics')
  metrics() {
    return this.esi.getMetricsSnapshot();
  }
}
