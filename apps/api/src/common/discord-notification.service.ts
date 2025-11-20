import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from './config';

export interface SupportRequestPayload {
  category: string;
  subject: string;
  description: string;
  context?: {
    url?: string;
    userAgent?: string;
  };
  user: {
    id: string;
    characterName?: string;
    email?: string;
  };
}

export interface FeedbackPayload {
  feedbackType: string;
  subject: string;
  message: string;
  rating?: number;
  user: {
    id: string;
    characterName?: string;
    email?: string;
  };
}

/**
 * DiscordNotificationService sends formatted messages to Discord channels via webhooks.
 *
 * Configuration:
 * - DISCORD_SUPPORT_WEBHOOK_URL: Webhook URL for support channel
 * - DISCORD_FEEDBACK_WEBHOOK_URL: Webhook URL for feedback channel
 *
 * Webhooks are created in Discord:
 * 1. Go to Server Settings > Integrations > Webhooks
 * 2. Create a new webhook for each channel (support, feedback)
 * 3. Copy the webhook URLs and add them to your .env file
 */
@Injectable()
export class DiscordNotificationService {
  private readonly logger = new Logger(DiscordNotificationService.name);
  private readonly supportWebhookUrl: string | undefined;
  private readonly feedbackWebhookUrl: string | undefined;
  private readonly environment: string;

  constructor() {
    this.supportWebhookUrl = process.env.DISCORD_SUPPORT_WEBHOOK_URL;
    this.feedbackWebhookUrl = process.env.DISCORD_FEEDBACK_WEBHOOK_URL;
    this.environment = process.env.NODE_ENV || 'development';

    if (!this.supportWebhookUrl) {
      this.logger.warn(
        'DISCORD_SUPPORT_WEBHOOK_URL not configured. Support notifications will not be sent.',
      );
    }

    if (!this.feedbackWebhookUrl) {
      this.logger.warn(
        'DISCORD_FEEDBACK_WEBHOOK_URL not configured. Feedback notifications will not be sent.',
      );
    }
  }

  /**
   * Send a support request to the Discord support channel
   */
  async sendSupportRequest(payload: SupportRequestPayload): Promise<void> {
    if (!this.supportWebhookUrl) {
      this.logger.warn(
        'Support webhook not configured. Skipping notification.',
      );
      return;
    }

    const embed = {
      title: '🆘 New Support Request',
      color: 0xff0000, // Red
      fields: [
        {
          name: 'Category',
          value: this.formatCategory(payload.category),
          inline: true,
        },
        {
          name: 'Environment',
          value: this.environment,
          inline: true,
        },
        {
          name: 'Subject',
          value: payload.subject,
          inline: false,
        },
        {
          name: 'Description',
          value: this.truncate(payload.description, 1024),
          inline: false,
        },
        {
          name: 'User',
          value: this.formatUser(payload.user),
          inline: false,
        },
      ],
      timestamp: new Date().toISOString(),
    };

    // Add context fields if provided
    if (payload.context?.url) {
      embed.fields.push({
        name: 'Page URL',
        value: this.truncate(payload.context.url, 1024),
        inline: false,
      });
    }

    if (payload.context?.userAgent) {
      embed.fields.push({
        name: 'User Agent',
        value: this.truncate(payload.context.userAgent, 1024),
        inline: false,
      });
    }

    await this.sendWebhook(this.supportWebhookUrl, { embeds: [embed] });
  }

  /**
   * Send feedback to the Discord feedback channel
   */
  async sendFeedback(payload: FeedbackPayload): Promise<void> {
    if (!this.feedbackWebhookUrl) {
      this.logger.warn(
        'Feedback webhook not configured. Skipping notification.',
      );
      return;
    }

    const embed = {
      title: '💡 New Feedback',
      color: 0x00ff00, // Green
      fields: [
        {
          name: 'Type',
          value: this.formatFeedbackType(payload.feedbackType),
          inline: true,
        },
        {
          name: 'Environment',
          value: this.environment,
          inline: true,
        },
        {
          name: 'Subject',
          value: payload.subject,
          inline: false,
        },
        {
          name: 'Message',
          value: this.truncate(payload.message, 1024),
          inline: false,
        },
        {
          name: 'User',
          value: this.formatUser(payload.user),
          inline: false,
        },
      ],
      timestamp: new Date().toISOString(),
    };

    // Add rating if provided
    if (payload.rating) {
      const stars = '⭐'.repeat(payload.rating);
      embed.fields.push({
        name: 'Rating',
        value: `${stars} (${payload.rating}/5)`,
        inline: false,
      });
    }

    await this.sendWebhook(this.feedbackWebhookUrl, { embeds: [embed] });
  }

  /**
   * Send a webhook message to Discord
   */
  private async sendWebhook(
    webhookUrl: string,
    payload: Record<string, any>,
  ): Promise<void> {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `Discord webhook failed: ${response.status} ${response.statusText} - ${text}`,
        );
      }

      this.logger.log('Successfully sent Discord notification');
    } catch (error) {
      this.logger.error('Failed to send Discord webhook', error);
      // Don't throw - we don't want to fail the request if Discord is down
      // The support/feedback is already submitted, Discord is just a notification
    }
  }

  /**
   * Format category for display
   */
  private formatCategory(category: string): string {
    const categoryMap: Record<string, string> = {
      technical: '🔧 Technical Issue',
      billing: '💰 Billing',
      account: '👤 Account',
      question: '❓ General Question',
      other: '📋 Other',
    };
    return categoryMap[category] || category;
  }

  /**
   * Format feedback type for display
   */
  private formatFeedbackType(type: string): string {
    const typeMap: Record<string, string> = {
      bug: '🐛 Bug Report',
      feature: '✨ Feature Request',
      improvement: '🚀 Improvement Suggestion',
      general: '💬 General Feedback',
      other: '📋 Other',
    };
    return typeMap[type] || type;
  }

  /**
   * Format user info for display
   */
  private formatUser(user: {
    id: string;
    characterName?: string;
    email?: string;
  }): string {
    const parts = [`User ID: ${user.id}`];
    if (user.characterName) {
      parts.push(`Character: ${user.characterName}`);
    }
    if (user.email) {
      parts.push(`Email: ${user.email}`);
    }
    return parts.join('\n');
  }

  /**
   * Truncate text to fit Discord's field limits
   */
  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.slice(0, maxLength - 3) + '...';
  }
}
