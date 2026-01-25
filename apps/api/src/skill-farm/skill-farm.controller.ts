import { Body, Controller, Get, Param, Patch, Put, Post } from '@nestjs/common';
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
import { SkillFarmService } from './skill-farm.service';
import {
  UpdateSkillFarmCharacterDto,
  UpdateSkillFarmSettingsDto,
  PreviewSkillFarmPlanDto,
} from './dto/skill-farm.dto';
import { SkillFarmMathService } from './skill-farm.math.service';
import type {
  SkillFarmMathInputs,
  SkillFarmMathResult,
} from '@eve/api-contracts';
import { Public } from '@api/characters/decorators/public.decorator';
import { SkillFarmMarketPricesService } from './skill-farm.market-prices.service';

@ApiTags('skill-farm')
@ApiBearerAuth()
@Controller('skill-farm')
export class SkillFarmController {
  constructor(
    private readonly skillFarm: SkillFarmService,
    private readonly math: SkillFarmMathService,
    private readonly marketPrices: SkillFarmMarketPricesService,
  ) {}

  @Get('settings')
  @ApiOperation({ summary: 'Get my skill farm economic settings' })
  async getSettings(@CurrentUser() user: RequestUser | null) {
    const userId = user?.userId;
    if (!userId) {
      return await this.skillFarm.getSettingsForUser(''); // returns defaults
    }
    return await this.skillFarm.getSettingsForUser(userId);
  }

  @Put('settings')
  @ApiOperation({ summary: 'Update my skill farm economic settings' })
  async updateSettings(
    @CurrentUser() user: RequestUser | null,
    @Body() body: UpdateSkillFarmSettingsDto,
  ) {
    const userId = user?.userId;
    if (!userId) {
      return await this.skillFarm.getSettingsForUser(''); // no-op for anonymous
    }
    return await this.skillFarm.updateSettingsForUser(userId, body);
  }

  @Get('characters')
  @ApiOperation({
    summary:
      'List my characters with skill farm requirement status and configuration',
  })
  async listCharacters(@CurrentUser() user: RequestUser | null) {
    const userId = user?.userId;
    if (!userId) return [];
    return await this.skillFarm.listCharactersWithStatus(userId);
  }

  @Patch('characters/:characterId')
  @ApiOperation({
    summary:
      'Update skill farm configuration for a character (candidate/active/plan)',
  })
  @ApiParam({ name: 'characterId', description: 'Character ID' })
  async updateCharacterConfig(
    @CurrentUser() user: RequestUser | null,
    @Param('characterId') characterId: string,
    @Body() body: UpdateSkillFarmCharacterDto,
  ) {
    const userId = user?.userId;
    if (!userId) return [];
    const id = Number(characterId);
    return await this.skillFarm.updateCharacterConfig(userId, id, body);
  }

  @Get('tracking')
  @ApiOperation({
    summary:
      'Get tracking snapshot for my active skill farm characters (extractable SP & queue status)',
  })
  async getTracking(@CurrentUser() user: RequestUser | null) {
    const userId = user?.userId;
    if (!userId) {
      return {
        characters: [],
        generatedAt: new Date().toISOString(),
      };
    }
    return await this.skillFarm.getTrackingSnapshot(userId);
  }

  @Public()
  @Get('market-prices')
  @ApiOperation({
    summary:
      'Fetch market prices for key skill-farm items (PLEX, extractor, injector) at the default hub station',
  })
  async getMarketPrices() {
    return await this.marketPrices.getSnapshot();
  }

  @Post('math/preview')
  @ApiOperation({
    summary:
      'Preview skill farm economics (SP, extractors, profit) for given assumptions',
  })
  async mathPreview(
    @CurrentUser() user: RequestUser | null,
    @Body() body: SkillFarmMathInputs,
  ): Promise<SkillFarmMathResult> {
    // For V1 we do not enforce userId on inputs; they are purely numeric assumptions.
    return this.math.compute(body);
  }

  @Post('plan/preview')
  @ApiOperation({
    summary:
      'Preview an auto-generated skill-farm crop plan (single attribute map) and get an EVE-importable text block',
  })
  async previewPlan(
    @CurrentUser() user: RequestUser | null,
    @Body() body: PreviewSkillFarmPlanDto,
  ) {
    const userId = user?.userId;
    if (!userId) return null;
    return await this.skillFarm.previewFarmPlan(userId, body);
  }
}
