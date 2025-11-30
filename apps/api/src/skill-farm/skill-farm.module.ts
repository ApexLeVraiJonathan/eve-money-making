import { Module, Logger } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CharactersModule } from '../characters/characters.module';
import { EsiModule } from '../esi/esi.module';
import { SkillFarmController } from './skill-farm.controller';

/**
 * SkillFarmModule
 *
 * Product-level module dedicated to skill farm planning and optimization:
 * - Skill queue and SP growth projections
 * - Injector/extractor break-even and profit analysis
 * - Account/character configurations for farms
 *
 * This module reuses lower-level services (characters, ESI, wallet, etc.)
 * but keeps product-specific orchestration and HTTP surface localized here.
 */
@Module({
  imports: [PrismaModule, CharactersModule, EsiModule],
  controllers: [SkillFarmController],
  providers: [Logger],
})
export class SkillFarmModule {}
