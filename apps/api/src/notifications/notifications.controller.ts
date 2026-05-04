import {
  Controller,
  Get,
  Patch,
  Query,
  Res,
  Delete,
  Body,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import {
  CurrentUser,
  type RequestUser,
} from '@api/characters/decorators/current-user.decorator';
import { Public } from '@api/characters/decorators/public.decorator';
import { DiscordOauthService } from './discord-oauth.service';
import {
  NotificationPreferenceItemDto,
  UpdateNotificationPreferencesDto,
} from './dto/notification-preferences.dto';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationService } from './notification.service';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly discordOauth: DiscordOauthService,
    private readonly preferences: NotificationPreferencesService,
    private readonly notifications: NotificationService,
  ) {}

  @Get('discord/connect')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Start Discord account linking for the current user',
  })
  @ApiFoundResponse({ description: 'Redirects to Discord OAuth authorization' })
  async connectDiscord(
    @CurrentUser() user: RequestUser | null,
    @Res() res: Response,
    @Query('returnUrl') returnUrl?: string,
  ) {
    if (!user?.userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const url = await this.discordOauth.getAuthorizeUrl(user.userId, returnUrl);
    res.redirect(url);
  }

  @Public()
  @Get('discord/callback')
  @ApiOperation({ summary: 'Discord OAuth callback for account linking' })
  @ApiFoundResponse({ description: 'Redirects after Discord OAuth callback' })
  async discordCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ) {
    if (!code || !state) {
      res.status(400).send('Missing code or state');
      return;
    }

    try {
      const redirectUrl = await this.discordOauth.handleCallback(code, state);
      res.redirect(redirectUrl);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to link Discord account';
      res
        .status(500)
        .send(
          `<html><body style="font-family:sans-serif;padding:40px;text-align:center;"><h1>Discord Linking Failed</h1><p>${message}</p></body></html>`,
        );
    }
  }

  @Get('discord/account')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get the current user Discord account link (if any)',
  })
  @ApiOkResponse({ description: 'Current user Discord account link or null' })
  async getDiscordAccount(@CurrentUser() user: RequestUser | null) {
    if (!user?.userId) return null;
    return await this.discordOauth.getAccountForUser(user.userId);
  }

  @Delete('discord/account')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disconnect Discord account from current user' })
  @ApiOkResponse({ description: 'Discord account disconnect result' })
  async disconnectDiscord(@CurrentUser() user: RequestUser | null) {
    if (!user?.userId) {
      return { ok: false as const };
    }
    await this.discordOauth.disconnectForUser(user.userId);
    // Ensure we also disable notification preferences. Otherwise the UI can
    // appear "configured" even though Discord is no longer connected.
    await this.preferences.disableAllForUser(user.userId);
    return { ok: true as const };
  }

  @Get('preferences')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get notification preferences for current user',
  })
  @ApiOkResponse({ description: 'Current user notification preferences' })
  async getPreferences(
    @CurrentUser() user: RequestUser | null,
  ): Promise<NotificationPreferenceItemDto[]> {
    if (!user?.userId) {
      return [];
    }
    return await this.preferences.getForUser(user.userId);
  }

  @Patch('preferences')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Update notification preferences for current user (partial or full set)',
  })
  @ApiOkResponse({ description: 'Notification preference update result' })
  async updatePreferences(
    @CurrentUser() user: RequestUser | null,
    @Body() body: UpdateNotificationPreferencesDto,
  ): Promise<{ ok: boolean }> {
    if (!user?.userId) {
      return { ok: false };
    }
    await this.preferences.updateForUser(user.userId, body.preferences);
    return { ok: true };
  }

  @Post('debug/test-dm')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Send a test Discord DM to the currently authenticated user to verify Discord linking',
  })
  @ApiOkResponse({ description: 'Discord test DM send result' })
  async sendTestDm(@CurrentUser() user: RequestUser | null) {
    if (!user?.userId) {
      return {
        ok: false as const,
        error: 'Not authenticated',
      };
    }

    try {
      await this.notifications.sendTestDmToUser(user.userId);
      return { ok: true as const };
    } catch (error) {
      return {
        ok: false as const,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to send test notification',
      };
    }
  }

  @Post('debug/tradecraft/cycle-planned')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'DEBUG: Send Tradecraft cycle planned DM preview' })
  @ApiOkResponse({ description: 'Cycle planned DM preview result' })
  async debugTradecraftCyclePlanned(
    @CurrentUser() user: RequestUser | null,
    @Body()
    body: {
      cycleId?: string;
      userId?: string;
    },
  ) {
    if (!user?.userId)
      return { ok: false as const, error: 'Not authenticated' };
    const targetUserId =
      body?.userId && user.role === 'ADMIN' ? body.userId : user.userId;
    try {
      return await this.notifications.debugSendTradecraftCyclePlannedToUser({
        userId: targetUserId,
        cycleId: body?.cycleId,
      });
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  @Post('debug/tradecraft/cycle-started')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'DEBUG: Send Tradecraft cycle started DM preview' })
  @ApiOkResponse({ description: 'Cycle started DM preview result' })
  async debugTradecraftCycleStarted(
    @CurrentUser() user: RequestUser | null,
    @Body()
    body: {
      cycleId?: string;
      userId?: string;
    },
  ) {
    if (!user?.userId)
      return { ok: false as const, error: 'Not authenticated' };
    const targetUserId =
      body?.userId && user.role === 'ADMIN' ? body.userId : user.userId;
    try {
      return await this.notifications.debugSendTradecraftCycleStartedToUser({
        userId: targetUserId,
        cycleId: body?.cycleId,
      });
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  @Post('debug/tradecraft/cycle-results')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'DEBUG: Send Tradecraft cycle results DM preview' })
  @ApiOkResponse({ description: 'Cycle results DM preview result' })
  async debugTradecraftCycleResults(
    @CurrentUser() user: RequestUser | null,
    @Body()
    body: {
      cycleId?: string;
      userId?: string;
    },
  ) {
    if (!user?.userId)
      return { ok: false as const, error: 'Not authenticated' };
    const targetUserId =
      body?.userId && user.role === 'ADMIN' ? body.userId : user.userId;
    try {
      return await this.notifications.debugSendTradecraftCycleResultsToUser({
        userId: targetUserId,
        cycleId: body?.cycleId,
      });
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  @Post('debug/tradecraft/payout-sent')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'DEBUG: Send Tradecraft payout sent DM preview' })
  @ApiOkResponse({ description: 'Payout sent DM preview result' })
  async debugTradecraftPayoutSent(
    @CurrentUser() user: RequestUser | null,
    @Body()
    body: {
      participationId?: string;
      userId?: string;
    },
  ) {
    if (!user?.userId)
      return { ok: false as const, error: 'Not authenticated' };
    const targetUserId =
      body?.userId && user.role === 'ADMIN' ? body.userId : user.userId;
    try {
      return await this.notifications.debugSendTradecraftPayoutSentToUser({
        userId: targetUserId,
        participationId: body?.participationId,
      });
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  @Post('debug/expiries')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'ADMIN: Send a preview of grouped expiry notifications (PLEX/MCT/Boosters) for the current user',
  })
  @ApiOkResponse({ description: 'Expiry notification preview result' })
  async sendExpiryPreview(@CurrentUser() user: RequestUser | null) {
    if (!user?.userId) {
      return {
        ok: false as const,
        error: 'Not authenticated',
      };
    }

    if (user.role !== 'ADMIN') {
      return {
        ok: false as const,
        error: 'Forbidden: admin only endpoint',
      };
    }

    try {
      await this.notifications.sendExpirySummaries({
        onlyUserId: user.userId,
        forceAll: true,
      });
      return { ok: true as const };
    } catch (error) {
      return {
        ok: false as const,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to send expiry notification preview',
      };
    }
  }
}
