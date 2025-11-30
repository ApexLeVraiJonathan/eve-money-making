import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Delete,
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
import { CharacterManagementService } from './character-management.service';
import {
  SetPrimaryCharacterDto,
  CreateAccountDto,
  UpdateAccountDto,
  AssignCharacterToAccountDto,
  CreatePlexSubscriptionDto,
  UpdatePlexSubscriptionDto,
  CreateBoosterDto,
  UpdateBoosterDto,
} from './dto/character-management.dto';

@ApiTags('character-management')
@ApiBearerAuth()
@Controller('character-management/me')
export class CharacterManagementController {
  constructor(
    private readonly characterManagement: CharacterManagementService,
  ) {}

  @Get('characters')
  @ApiOperation({ summary: 'List my linked characters with metadata' })
  async getMyCharacters(@CurrentUser() user: RequestUser | null) {
    const userId = user?.userId;
    if (!userId) return [];
    return await this.characterManagement.getMyCharacters(userId);
  }

  @Post('primary-character')
  @ApiOperation({ summary: 'Set my primary character' })
  async setMyPrimaryCharacter(
    @CurrentUser() user: RequestUser | null,
    @Body() body: SetPrimaryCharacterDto,
  ) {
    const userId = user?.userId;
    if (!userId) return { ok: false as const };
    return await this.characterManagement.setMyPrimaryCharacter(
      userId,
      body.characterId,
    );
  }

  @Get('accounts')
  @ApiOperation({ summary: 'List my EVE accounts and unassigned characters' })
  async getMyAccounts(@CurrentUser() user: RequestUser | null) {
    const userId = user?.userId;
    if (!userId) return [];
    return await this.characterManagement.getMyAccounts(userId);
  }

  @Post('accounts')
  @ApiOperation({ summary: 'Create a new EVE account group' })
  async createAccount(
    @CurrentUser() user: RequestUser | null,
    @Body() body: CreateAccountDto,
  ) {
    const userId = user?.userId;
    if (!userId) return { ok: false as const };
    return await this.characterManagement.createAccount(userId, body);
  }

  @Patch('accounts/:accountId')
  @ApiOperation({ summary: 'Update account label/notes' })
  @ApiParam({ name: 'accountId', description: 'EVE account id' })
  async updateAccount(
    @CurrentUser() user: RequestUser | null,
    @Param('accountId') accountId: string,
    @Body() body: UpdateAccountDto,
  ) {
    const userId = user?.userId;
    if (!userId) return { ok: false as const };
    return await this.characterManagement.updateAccountMetadata(
      userId,
      accountId,
      body,
    );
  }

  @Delete('accounts/:accountId')
  @ApiOperation({ summary: 'Delete an EVE account group' })
  @ApiParam({ name: 'accountId', description: 'EVE account id' })
  async deleteAccount(
    @CurrentUser() user: RequestUser | null,
    @Param('accountId') accountId: string,
  ) {
    const userId = user?.userId;
    if (!userId) return { ok: false as const };
    return await this.characterManagement.deleteAccount(userId, accountId);
  }

  @Post('accounts/:accountId/characters')
  @ApiOperation({ summary: 'Assign one of my characters to an account' })
  @ApiParam({ name: 'accountId', description: 'EVE account id' })
  async assignCharacter(
    @CurrentUser() user: RequestUser | null,
    @Param('accountId') accountId: string,
    @Body() body: AssignCharacterToAccountDto,
  ) {
    const userId = user?.userId;
    if (!userId) return { ok: false as const };
    return await this.characterManagement.assignCharacterToAccount(
      userId,
      accountId,
      body.characterId,
    );
  }

  @Delete('accounts/:accountId/characters/:characterId')
  @ApiOperation({ summary: 'Remove a character from an account (unassign)' })
  @ApiParam({ name: 'accountId', description: 'EVE account id' })
  @ApiParam({ name: 'characterId', description: 'Character ID' })
  async unassignCharacter(
    @CurrentUser() user: RequestUser | null,
    @Param('accountId') accountId: string,
    @Param('characterId') characterId: string,
  ) {
    const userId = user?.userId;
    if (!userId) return { ok: false as const };
    const id = Number(characterId);
    return await this.characterManagement.unassignCharacterFromAccount(
      userId,
      accountId,
      id,
    );
  }

  @Get('accounts/:accountId/plex')
  @ApiOperation({ summary: 'List PLEX/subscription periods for an account' })
  @ApiParam({ name: 'accountId', description: 'EVE account id' })
  async listPlex(
    @CurrentUser() user: RequestUser | null,
    @Param('accountId') accountId: string,
  ) {
    const userId = user?.userId;
    if (!userId) return [];
    return await this.characterManagement.listPlexSubscriptions(
      userId,
      accountId,
    );
  }

  @Get('accounts/:accountId/mct')
  @ApiOperation({ summary: 'List MCT slots for an account' })
  @ApiParam({ name: 'accountId', description: 'EVE account id' })
  async listMct(
    @CurrentUser() user: RequestUser | null,
    @Param('accountId') accountId: string,
  ) {
    const userId = user?.userId;
    if (!userId) return [];
    return await this.characterManagement.listMctSlots(userId, accountId);
  }

  @Post('accounts/:accountId/plex')
  @ApiOperation({ summary: 'Create a PLEX/subscription period for an account' })
  @ApiParam({ name: 'accountId', description: 'EVE account id' })
  async createPlex(
    @CurrentUser() user: RequestUser | null,
    @Param('accountId') accountId: string,
    @Body() body: CreatePlexSubscriptionDto,
  ) {
    const userId = user?.userId;
    if (!userId) return { ok: false as const };
    return await this.characterManagement.createPlexSubscription(
      userId,
      accountId,
      body,
    );
  }

  @Post('accounts/:accountId/mct')
  @ApiOperation({ summary: 'Create an MCT slot for an account' })
  @ApiParam({ name: 'accountId', description: 'EVE account id' })
  async createMct(
    @CurrentUser() user: RequestUser | null,
    @Param('accountId') accountId: string,
    @Body() body: { expiresAt: string; notes?: string },
  ) {
    const userId = user?.userId;
    if (!userId) return { ok: false as const };
    return await this.characterManagement.createMctSlot(
      userId,
      accountId,
      body,
    );
  }

  @Patch('accounts/:accountId/plex/:subscriptionId')
  @ApiOperation({ summary: 'Update a PLEX/subscription period for an account' })
  @ApiParam({ name: 'accountId', description: 'EVE account id' })
  @ApiParam({ name: 'subscriptionId', description: 'Subscription id' })
  async updatePlex(
    @CurrentUser() user: RequestUser | null,
    @Param('accountId') accountId: string,
    @Param('subscriptionId') subscriptionId: string,
    @Body() body: UpdatePlexSubscriptionDto,
  ) {
    const userId = user?.userId;
    if (!userId) return { ok: false as const };
    return await this.characterManagement.updatePlexSubscription(
      userId,
      accountId,
      subscriptionId,
      body,
    );
  }

  @Delete('accounts/:accountId/plex/:subscriptionId')
  @ApiOperation({ summary: 'Delete a PLEX/subscription period' })
  @ApiParam({ name: 'accountId', description: 'EVE account id' })
  @ApiParam({ name: 'subscriptionId', description: 'Subscription id' })
  async deletePlex(
    @CurrentUser() user: RequestUser | null,
    @Param('accountId') accountId: string,
    @Param('subscriptionId') subscriptionId: string,
  ) {
    const userId = user?.userId;
    if (!userId) return { ok: false as const };
    return await this.characterManagement.deletePlexSubscription(
      userId,
      accountId,
      subscriptionId,
    );
  }

  @Delete('accounts/:accountId/mct/:slotId')
  @ApiOperation({ summary: 'Delete an MCT slot from an account' })
  @ApiParam({ name: 'accountId', description: 'EVE account id' })
  @ApiParam({ name: 'slotId', description: 'MCT slot id' })
  async deleteMct(
    @CurrentUser() user: RequestUser | null,
    @Param('accountId') accountId: string,
    @Param('slotId') slotId: string,
  ) {
    const userId = user?.userId;
    if (!userId) return { ok: false as const };
    return await this.characterManagement.deleteMctSlot(
      userId,
      accountId,
      slotId,
    );
  }

  @Get('characters/:characterId/boosters')
  @ApiOperation({ summary: 'List booster periods for one of my characters' })
  @ApiParam({ name: 'characterId', description: 'Character ID' })
  async listBoosters(
    @CurrentUser() user: RequestUser | null,
    @Param('characterId') characterId: string,
  ) {
    const userId = user?.userId;
    if (!userId) return [];
    const id = Number(characterId);
    return await this.characterManagement.listCharacterBoosters(userId, id);
  }

  @Post('characters/:characterId/boosters')
  @ApiOperation({ summary: 'Create a booster period for one of my characters' })
  @ApiParam({ name: 'characterId', description: 'Character ID' })
  async createBooster(
    @CurrentUser() user: RequestUser | null,
    @Param('characterId') characterId: string,
    @Body() body: CreateBoosterDto,
  ) {
    const userId = user?.userId;
    if (!userId) return { ok: false as const };
    const id = Number(characterId);
    return await this.characterManagement.createCharacterBooster(
      userId,
      id,
      body,
    );
  }

  @Patch('characters/:characterId/boosters/:boosterId')
  @ApiOperation({ summary: 'Update a booster period for one of my characters' })
  @ApiParam({ name: 'characterId', description: 'Character ID' })
  @ApiParam({ name: 'boosterId', description: 'Booster ID' })
  async updateBooster(
    @CurrentUser() user: RequestUser | null,
    @Param('characterId') characterId: string,
    @Param('boosterId') boosterId: string,
    @Body() body: UpdateBoosterDto,
  ) {
    const userId = user?.userId;
    if (!userId) return { ok: false as const };
    const id = Number(characterId);
    return await this.characterManagement.updateCharacterBooster(
      userId,
      id,
      boosterId,
      body,
    );
  }

  @Delete('characters/:characterId/boosters/:boosterId')
  @ApiOperation({ summary: 'Delete a booster period for one of my characters' })
  @ApiParam({ name: 'characterId', description: 'Character ID' })
  @ApiParam({ name: 'boosterId', description: 'Booster ID' })
  async deleteBooster(
    @CurrentUser() user: RequestUser | null,
    @Param('characterId') characterId: string,
    @Param('boosterId') boosterId: string,
  ) {
    const userId = user?.userId;
    if (!userId) return { ok: false as const };
    const id = Number(characterId);
    return await this.characterManagement.deleteCharacterBooster(
      userId,
      id,
      boosterId,
    );
  }

  @Get('overview')
  @ApiOperation({ summary: 'Aggregated overview for my linked characters' })
  async overview(@CurrentUser() user: RequestUser | null) {
    const userId = user?.userId;
    if (!userId) return { characters: [] as unknown[] };
    return await this.characterManagement.getOverview(userId);
  }

  @Get('characters/:characterId/training-queue')
  @ApiOperation({
    summary: 'Get training queue summary for one of my characters',
  })
  @ApiParam({ name: 'characterId', description: 'Character ID' })
  async getTrainingQueue(
    @CurrentUser() user: RequestUser | null,
    @Param('characterId') characterId: string,
  ) {
    const userId = user?.userId;
    if (!userId) return null;
    const id = Number(characterId);
    return await this.characterManagement.getCharacterTrainingQueue(userId, id);
  }

  @Get('characters/:characterId/skills')
  @ApiOperation({
    summary: 'Get learned skills snapshot for one of my characters',
  })
  @ApiParam({ name: 'characterId', description: 'Character ID' })
  async getSkills(
    @CurrentUser() user: RequestUser | null,
    @Param('characterId') characterId: string,
  ) {
    const userId = user?.userId;
    if (!userId) return null;
    const id = Number(characterId);
    return await this.characterManagement.getCharacterSkills(userId, id);
  }

  @Get('characters/:characterId/attributes')
  @ApiOperation({
    summary: 'Get current attributes & remap info for one of my characters',
  })
  @ApiParam({ name: 'characterId', description: 'Character ID' })
  async getAttributes(
    @CurrentUser() user: RequestUser | null,
    @Param('characterId') characterId: string,
  ) {
    const userId = user?.userId;
    if (!userId) return null;
    const id = Number(characterId);
    return await this.characterManagement.getCharacterAttributes(userId, id);
  }
}
