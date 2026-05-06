import { Module, Logger, forwardRef } from '@nestjs/common';
import { GameDataService } from './services/game-data.service';
import { ImportService } from './services/import.service';
import { SkillCatalogService } from './services/skill-catalog.service';
import { ImportController } from './import.controller';
import { SkillCatalogController } from './skill-catalog.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { DataImportModule } from '@shared/data-import';
import { EsiModule } from '../esi/esi.module';
import { MarketModule } from '../tradecraft/market/market.module';

@Module({
  imports: [
    PrismaModule,
    DataImportModule,
    EsiModule,
    forwardRef(() => MarketModule),
  ],
  providers: [GameDataService, ImportService, SkillCatalogService, Logger],
  controllers: [ImportController, SkillCatalogController],
  exports: [GameDataService, ImportService, SkillCatalogService],
})
export class GameDataModule {}
