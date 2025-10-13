import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Delete,
} from '@nestjs/common';
import { CurrentUser, type RequestUser } from '../auth/current-user.decorator';
import { UsersService } from './users.service';
import { Roles } from '../auth/roles.decorator';

@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  // Admin: list users with primary/characters
  @Get('admin/users')
  @Roles('ADMIN')
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
  async setRole(
    @Param('id') id: string,
    @Body() body: { role: 'ADMIN' | 'USER' },
  ) {
    return await this.users.setRole(id, body.role);
  }

  // Admin: force link a character to a user
  @Post('admin/users/:id/link-character')
  @Roles('ADMIN')
  async forceLink(
    @Param('id') id: string,
    @Body() body: { characterId: number },
  ) {
    return await this.users.forceLink(id, Number(body.characterId));
  }

  // Admin: set user's primary character
  @Patch('admin/users/:id/primary-character')
  @Roles('ADMIN')
  async adminSetPrimary(
    @Param('id') id: string,
    @Body() body: { characterId: number },
  ) {
    return await this.users.setPrimaryCharacter(id, Number(body.characterId));
  }

  // Admin: unlink a character from a user
  @Delete('admin/users/:id/characters/:characterId')
  @Roles('ADMIN')
  async adminUnlink(
    @Param('id') id: string,
    @Param('characterId') characterId: string,
  ) {
    return await this.users.unlinkCharacter(id, Number(characterId));
  }

  // User: list my linked characters
  @Get('users/me/characters')
  async myCharacters(@CurrentUser() user: RequestUser | null) {
    const userId = user?.userId ?? null;
    if (!userId) return [];
    return await this.users.listMyCharacters(userId);
  }

  @Patch('users/me/primary-character')
  async setPrimary(
    @CurrentUser() user: RequestUser | null,
    @Body() body: { characterId: number },
  ) {
    const userId = user?.userId ?? null;
    if (!userId) return { ok: false } as const;
    return await this.users.setPrimaryCharacter(
      userId,
      Number(body.characterId),
    );
  }

  @Delete('users/me/characters/:characterId')
  async unlink(
    @CurrentUser() user: RequestUser | null,
    @Param('characterId') characterId: string,
  ) {
    const userId = user?.userId ?? null;
    if (!userId) return { ok: false } as const;
    return await this.users.unlinkCharacter(userId, Number(characterId));
  }
}
