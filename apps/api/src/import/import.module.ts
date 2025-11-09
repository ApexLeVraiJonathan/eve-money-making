import { Module, Logger } from '@nestjs/common';
import { ImportService } from './import.service';
import { DataImportModule } from '@shared/data-import';
import { EsiModule } from '../esi/esi.module';
import { ImportController } from './import.controller';
import { GameDataModule } from '../game-data/game-data.module';
import { MarketDataModule } from '../market-data/market-data.module';

@Module({
  providers: [ImportService, Logger],
  imports: [DataImportModule, EsiModule, GameDataModule, MarketDataModule],
  controllers: [ImportController],
  exports: [ImportService],
})
export class ImportModule {}
