import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger';
import { CurrentUser, type RequestUser } from '../auth/current-user.decorator';
import { UsersService } from './users.service';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SetRoleRequest } from './dto/set-role.dto';
import { LinkCharacterRequest } from './dto/link-character.dto';

@ApiTags('admin', 'users')
@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  // Admin: list users with primary/characters
  @Get('admin/users')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all users (admin only)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async listUsers(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const take = Math.min(Math.max(Number(limit ?? '50'), 1), 200);
    const skip = Math.max(Number(offset ?? '0'), 0);
    return await this.users.listUsers(take, skip);
  }

  // Admin: change user role
  @Patch('admin/users/:id/role')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change user role (admin only)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  async setRole(
    @Param('id') id: string,
    @Body() body: SetRoleRequest,
  ) {
    return await this.users.setRole(id, body.role);
  }

  // Admin: force link a character to a user
  @Post('admin/users/:id/link-character')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Force link a character to a user (admin only)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  async forceLink(
    @Param('id') id: string,
    @Body() body: LinkCharacterRequest,
  ) {
    return await this.users.forceLink(id, body.characterId);
  }

  // Admin: set user's primary character
  @Patch('admin/users/:id/primary-character')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Set user's primary character (admin only)" })
  @ApiParam({ name: 'id', description: 'User ID' })
  async adminSetPrimary(
    @Param('id') id: string,
    @Body() body: LinkCharacterRequest,
  ) {
    return await this.users.setPrimaryCharacter(id, body.characterId);
  }

  // Admin: unlink a character from a user
  @Delete('admin/users/:id/characters/:characterId')
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unlink a character from a user (admin only)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiParam({ name: 'characterId', description: 'Character ID' })
  async adminUnlink(
    @Param('id') id: string,
    @Param('characterId') characterId: string,
  ) {
    return await this.users.unlinkCharacter(id, Number(characterId));
  }

  // User: list my linked characters
  @Get('users/me/characters')
  @ApiOperation({ summary: 'List my linked characters' })
  async myCharacters(@CurrentUser() user: RequestUser | null) {
    const userId = user?.userId ?? null;
    if (!userId) return [];
    return await this.users.listMyCharacters(userId);
  }

  @Patch('users/me/primary-character')
  @ApiOperation({ summary: 'Set my primary character' })
  async setPrimary(
    @CurrentUser() user: RequestUser | null,
    @Body() body: LinkCharacterRequest,
  ) {
    const userId = user?.userId ?? null;
    if (!userId) return { ok: false } as const;
    return await this.users.setPrimaryCharacter(
      userId,
      body.characterId,
    );
  }

  @Delete('users/me/characters/:characterId')
  @ApiOperation({ summary: 'Unlink one of my characters' })
  @ApiParam({ name: 'characterId', description: 'Character ID' })
  async unlink(
    @CurrentUser() user: RequestUser | null,
    @Param('characterId') characterId: string,
  ) {
    const userId = user?.userId ?? null;
    if (!userId) return { ok: false } as const;
    return await this.users.unlinkCharacter(userId, Number(characterId));
  }
}
