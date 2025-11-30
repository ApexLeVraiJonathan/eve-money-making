import { Module, Logger } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CharactersModule } from '../characters/characters.module';
import { EsiModule } from '../esi/esi.module';
import { CharacterManagementController } from './character-management.controller';
import { CharacterManagementService } from './character-management.service';

/**
 * CharacterManagementModule
 *
 * Product-level module focused on character and account management UX:
 * - Cross-account character overviews
 * - Aggregated character stats and dashboards
 * - Future management utilities that are not strictly auth/identity
 *
 * This module intentionally depends on `CharactersModule` for identity,
 * auth, and low-level character ownership but should not re-implement auth.
 */
@Module({
  imports: [PrismaModule, CharactersModule, EsiModule],
  controllers: [CharacterManagementController],
  providers: [Logger, CharacterManagementService],
  exports: [CharacterManagementService],
})
export class CharacterManagementModule {}
