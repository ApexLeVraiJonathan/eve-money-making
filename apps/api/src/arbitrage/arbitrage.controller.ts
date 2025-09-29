import { Controller } from '@nestjs/common';
import { ArbitrageService } from './arbitrage.service';

@Controller('arbitrage')
export class ArbitrageController {
  constructor(private readonly arbitrageService: ArbitrageService) {}
}
