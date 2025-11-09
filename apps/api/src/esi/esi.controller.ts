import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { EsiService } from './esi.service';

@ApiTags('esi')
@Controller('esi')
export class EsiController {
  constructor(private readonly esi: EsiService) {}

  @Public()
  @Get('metrics')
  @ApiOperation({ summary: 'Get ESI API metrics' })
  metrics() {
    return this.esi.getMetricsSnapshot();
  }
}
