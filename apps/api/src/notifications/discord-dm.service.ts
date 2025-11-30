import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { AppConfig } from '@api/common/config';

@Injectable()
export class DiscordDmService {
  private readonly logger = new Logger(DiscordDmService.name);
  private readonly apiBase = 'https://discord.com/api';

  private get botToken(): string | null {
    return AppConfig.discordBotToken();
  }

  private get isEnabled(): boolean {
    return !!this.botToken;
  }

  /**
   * Send a simple text-based DM to a Discord user.
   * Fails silently (logs only) if Discord bot token or permissions are missing.
   */
  async sendDirectMessage(
    discordUserId: string,
    content: string,
  ): Promise<void> {
    if (!this.isEnabled) {
      this.logger.warn(
        'Discord bot token is not configured. Skipping DM notification.',
      );
      return;
    }

    try {
      const token = this.botToken!;

      // 1) Create (or fetch) DM channel with recipient
      const channelRes = await axios.post<{ id: string }>(
        `${this.apiBase}/users/@me/channels`,
        { recipient_id: discordUserId },
        {
          headers: {
            Authorization: `Bot ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const channelId = channelRes.data.id;
      if (!channelId) {
        this.logger.warn(
          `Failed to create DM channel for Discord user ${discordUserId}`,
        );
        return;
      }

      // 2) Send message
      await axios.post(
        `${this.apiBase}/channels/${channelId}/messages`,
        { content },
        {
          headers: {
            Authorization: `Bot ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.log(
        `Sent Discord DM to user ${discordUserId} via channel ${channelId}`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error ?? 'unknown');
      this.logger.error(
        `Failed to send Discord DM to user ${discordUserId}: ${message}`,
      );
    }
  }
}
