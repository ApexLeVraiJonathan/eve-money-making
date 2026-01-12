import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type RequestUser,
} from '@api/characters/decorators/current-user.decorator';
import { SkillIssueAnalyzeDto } from './dto/skill-issue.dto';
import { SkillIssueService } from './skill-issue.service';

@ApiTags('skill-issue')
@ApiBearerAuth()
@Controller('skill-issue')
export class SkillIssueController {
  constructor(private readonly skillIssue: SkillIssueService) {}

  @Post('analyze')
  @ApiOperation({
    summary:
      'Analyze an EFT fit against a character and return required + influencing skills (MVP-A, no numbers)',
  })
  async analyze(
    @CurrentUser() user: RequestUser | null,
    @Body() body: SkillIssueAnalyzeDto,
  ) {
    const userId = user?.userId;
    if (!userId) {
      return {
        fit: {
          shipName: null,
          shipTypeId: null,
          extractedTypeNames: [],
          unresolvedTypeNames: [],
          fitTypeIds: [],
        },
        requiredSkills: [],
        influencingSkills: [],
      };
    }

    return await this.skillIssue.analyzeForUser(userId, {
      characterId: body.characterId,
      eft: body.eft,
    });
  }
}
