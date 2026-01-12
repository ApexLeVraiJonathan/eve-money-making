import { Module } from '@nestjs/common';
import { SkillIssueController } from './skill-issue.controller';
import { SkillIssueService } from './skill-issue.service';
import { PrismaModule } from '@api/prisma/prisma.module';
import { CharacterManagementModule } from '../character-management/character-management.module';

@Module({
  imports: [PrismaModule, CharacterManagementModule],
  controllers: [SkillIssueController],
  providers: [SkillIssueService],
})
export class SkillIssueModule {}
