import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentUser,
  type RequestUser,
} from '../characters/decorators/current-user.decorator';
import { SkillPlansService } from './skill-plans.service';
import {
  AttributeSuggestionRequestDto,
  CreateSkillPlanDto,
  ImportSkillPlanDto,
  OptimizationPreviewRequestDto,
  UpdateSkillPlanDto,
} from './dto/skill-plans.dto';

@ApiTags('skill-plans')
@ApiBearerAuth()
@Controller('skill-plans')
export class SkillPlansController {
  constructor(private readonly skillPlans: SkillPlansService) {}

  @Get()
  @ApiOperation({ summary: 'List my skill plans' })
  async listPlans(@CurrentUser() user: RequestUser | null) {
    const userId = user?.userId;
    if (!userId) return [];
    return await this.skillPlans.listPlansForUser(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new skill plan' })
  async createPlan(
    @CurrentUser() user: RequestUser | null,
    @Body() body: CreateSkillPlanDto,
  ) {
    const userId = user?.userId;
    if (!userId) return { ok: false as const };
    return await this.skillPlans.createPlanForUser(userId, {
      name: body.name,
      description: body.description ?? null,
    });
  }

  @Post('import')
  @ApiOperation({
    summary:
      'Parse a skill plan text (EVE format or app format) into a normalised plan preview without saving',
  })
  async importPreview(
    @CurrentUser() user: RequestUser | null,
    @Body() body: ImportSkillPlanDto,
  ) {
    const userId = user?.userId;
    if (!userId) {
      return {
        plan: null,
        issues: [
          {
            line: 0,
            raw: '',
            error: 'Not authenticated',
          },
        ],
      };
    }

    return await this.skillPlans.previewImportSkillPlan(userId, {
      text: body.text,
      format: body.format,
      nameHint: body.nameHint,
    });
  }

  @Get('catalog/search')
  @ApiOperation({
    summary: 'Search skill catalog by name (SDE-backed)',
  })
  async searchCatalog(
    @CurrentUser() user: RequestUser | null,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = user?.userId;
    if (!userId) return [];
    const query = (q ?? '').trim();
    if (query.length < 2) return [];
    const cappedLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
    return await this.skillPlans.searchSkillCatalog(query, cappedLimit);
  }

  @Get('encyclopedia')
  @ApiOperation({
    summary:
      'Get full skill encyclopedia with all skills organized by category/group',
  })
  async getEncyclopedia(@CurrentUser() user: RequestUser | null) {
    const userId = user?.userId;
    if (!userId) {
      return { categories: [], skills: [] };
    }
    return await this.skillPlans.getSkillEncyclopedia();
  }

  @Get(':planId')
  @ApiOperation({ summary: 'Get a skill plan with its steps' })
  @ApiParam({ name: 'planId', description: 'Skill plan ID' })
  async getPlan(
    @CurrentUser() user: RequestUser | null,
    @Param('planId') planId: string,
  ) {
    const userId = user?.userId;
    if (!userId) return null;
    return await this.skillPlans.getPlanForUser(userId, planId);
  }

  @Patch(':planId')
  @ApiOperation({
    summary: 'Update a skill plan (name/description/steps)',
  })
  @ApiParam({ name: 'planId', description: 'Skill plan ID' })
  async updatePlan(
    @CurrentUser() user: RequestUser | null,
    @Param('planId') planId: string,
    @Body() body: UpdateSkillPlanDto,
  ) {
    const userId = user?.userId;
    if (!userId) return null;
    return await this.skillPlans.updatePlanForUser(userId, planId, {
      name: body.name,
      description: body.description,
      steps: body.steps?.map((s) => ({
        skillId: s.skillId,
        targetLevel: s.targetLevel,
        order: s.order,
        notes: s.notes,
      })),
    });
  }

  @Post(':planId/import')
  @ApiOperation({
    summary:
      'Import a skill plan text into an existing plan, replacing its steps with the parsed result',
  })
  @ApiParam({ name: 'planId', description: 'Skill plan ID' })
  async importIntoPlan(
    @CurrentUser() user: RequestUser | null,
    @Param('planId') planId: string,
    @Body() body: ImportSkillPlanDto,
  ) {
    const userId = user?.userId;
    if (!userId) {
      return null;
    }

    return await this.skillPlans.importPlanFromTextForUser(userId, planId, {
      text: body.text,
      format: body.format,
      nameHint: body.nameHint,
    });
  }

  @Delete(':planId')
  @ApiOperation({ summary: 'Delete a skill plan' })
  @ApiParam({ name: 'planId', description: 'Skill plan ID' })
  async deletePlan(
    @CurrentUser() user: RequestUser | null,
    @Param('planId') planId: string,
  ) {
    const userId = user?.userId;
    if (!userId) return { ok: false as const };
    return await this.skillPlans.deletePlanForUser(userId, planId);
  }

  @Post(':planId/export-text')
  @ApiOperation({
    summary: 'Export a skill plan as text for in-game import',
  })
  @ApiParam({ name: 'planId', description: 'Skill plan ID' })
  async exportText(
    @CurrentUser() user: RequestUser | null,
    @Param('planId') planId: string,
  ) {
    const userId = user?.userId;
    if (!userId) return { text: '' };
    return await this.skillPlans.exportPlanText(userId, planId);
  }

  @Post(':planId/attribute-suggestion')
  @ApiOperation({
    summary:
      'Suggest an attribute remap that fits the skills in this plan (optionally for a specific character)',
  })
  @ApiParam({ name: 'planId', description: 'Skill plan ID' })
  async suggestAttributes(
    @CurrentUser() user: RequestUser | null,
    @Param('planId') planId: string,
    @Body() body: AttributeSuggestionRequestDto,
  ) {
    const userId = user?.userId;
    if (!userId) {
      return {
        recommendedAttributes: null,
        reasoning: 'Not authenticated',
        estimatedTrainingSecondsCurrent: null,
        estimatedTrainingSecondsRecommended: null,
      };
    }
    return await this.skillPlans.suggestAttributesForPlan(userId, planId, {
      characterId: body.characterId,
    });
  }

  @Post(':planId/optimization/preview')
  @ApiOperation({
    summary:
      'Preview optimisation for a skill plan (attribute-focused, single remap window)',
  })
  @ApiParam({ name: 'planId', description: 'Skill plan ID' })
  async previewOptimization(
    @CurrentUser() user: RequestUser | null,
    @Param('planId') planId: string,
    @Body() body: OptimizationPreviewRequestDto,
  ) {
    const userId = user?.userId;
    if (!userId) return null;
    return await this.skillPlans.previewOptimizationForPlan(userId, planId, {
      mode: body.mode,
      maxRemaps: body.maxRemaps,
      characterId: body.characterId,
      implantBonus: body.implantBonus,
      boosterBonus: body.boosterBonus,
    });
  }

  @Post(':planId/optimization/apply')
  @ApiOperation({
    summary:
      'Apply optimisation settings to a plan (persists optimisation config in plan metadata)',
  })
  @ApiParam({ name: 'planId', description: 'Skill plan ID' })
  async applyOptimization(
    @CurrentUser() user: RequestUser | null,
    @Param('planId') planId: string,
    @Body() body: OptimizationPreviewRequestDto,
  ) {
    const userId = user?.userId;
    if (!userId) return null;
    return await this.skillPlans.applyOptimizationForPlan(userId, planId, {
      mode: body.mode,
      maxRemaps: body.maxRemaps,
      characterId: body.characterId,
      implantBonus: body.implantBonus,
      boosterBonus: body.boosterBonus,
    });
  }

  @Post(':planId/assign')
  @ApiOperation({
    summary: 'Assign a skill plan to one of my characters',
  })
  @ApiParam({ name: 'planId', description: 'Skill plan ID' })
  async assignPlan(
    @CurrentUser() user: RequestUser | null,
    @Param('planId') planId: string,
    @Body() body: { characterId: number },
  ) {
    const userId = user?.userId;
    if (!userId) return null;
    return await this.skillPlans.assignPlanToCharacter(
      userId,
      planId,
      body.characterId,
    );
  }

  @Delete(':planId/assign/:characterId')
  @ApiOperation({
    summary: 'Unassign a skill plan from a character',
  })
  @ApiParam({ name: 'planId', description: 'Skill plan ID' })
  async unassignPlan(
    @CurrentUser() user: RequestUser | null,
    @Param('planId') planId: string,
    @Param('characterId') characterId: string,
  ) {
    const userId = user?.userId;
    if (!userId) return { ok: false as const };
    return await this.skillPlans.unassignPlanFromCharacter(
      userId,
      planId,
      Number(characterId),
    );
  }

  @Get(':planId/progress/:characterId')
  @ApiOperation({
    summary:
      'Get progress for a skill plan against a specific character, including queue comparison',
  })
  @ApiParam({ name: 'planId', description: 'Skill plan ID' })
  async getPlanProgress(
    @CurrentUser() user: RequestUser | null,
    @Param('planId') planId: string,
    @Param('characterId') characterId: string,
  ) {
    const userId = user?.userId;
    if (!userId) return null;
    return await this.skillPlans.getPlanProgressForCharacter(
      userId,
      planId,
      Number(characterId),
    );
  }
}
