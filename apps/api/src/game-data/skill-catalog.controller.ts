import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type RequestUser,
} from '../characters/decorators/current-user.decorator';
import { SkillCatalogService } from './services/skill-catalog.service';

@ApiTags('game-data')
@ApiBearerAuth()
@Controller('game-data/skills')
export class SkillCatalogController {
  constructor(private readonly skillCatalog: SkillCatalogService) {}

  @Get('catalog/search')
  @ApiOperation({ summary: 'Search skill catalog by name' })
  @ApiOkResponse({ description: 'Skill catalog search results' })
  async searchCatalog(
    @CurrentUser() user: RequestUser | null,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ) {
    if (!user?.userId) return [];
    const query = (q ?? '').trim();
    if (query.length < 2) return [];
    const cappedLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
    return await this.skillCatalog.searchSkillCatalog(query, cappedLimit);
  }

  @Get('encyclopedia')
  @ApiOperation({ summary: 'Get full skill encyclopedia' })
  @ApiOkResponse({ description: 'Skill encyclopedia' })
  async getEncyclopedia(@CurrentUser() user: RequestUser | null) {
    if (!user?.userId) {
      return { categories: [], skills: [] };
    }
    return await this.skillCatalog.getSkillEncyclopedia();
  }
}
