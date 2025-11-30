import { Module, Logger } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EsiModule } from '../esi/esi.module';
import { CharacterManagementModule } from '../character-management/character-management.module';
import { SkillPlansController } from './skill-plans.controller';
import { SkillPlansService } from './skill-plans.service';

@Module({
  imports: [PrismaModule, EsiModule, CharacterManagementModule],
  controllers: [SkillPlansController],
  providers: [Logger, SkillPlansService],
  exports: [SkillPlansService],
})
export class SkillPlansModule {}
