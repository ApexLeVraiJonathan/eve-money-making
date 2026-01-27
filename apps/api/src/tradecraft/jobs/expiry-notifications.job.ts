import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationService } from '@api/notifications/notification.service';
import { JobsGate } from './jobs-gate.service';
import { JobKeys } from './job-keys';

@Injectable()
export class ExpiryNotificationsJob {
  private readonly logger = new Logger(ExpiryNotificationsJob.name);

  constructor(
    private readonly gate: JobsGate,
    private readonly notifications: NotificationService,
  ) {}

  /**
   * Daily job to send grouped PLEX/MCT/booster expiry notifications.
   *
   * Runs once per day to avoid spamming; thresholds are handled inside
   * NotificationService.sendExpirySummaries.
   */
  @Cron('0 9 * * *')
  async run(): Promise<void> {
    if (!this.gate.shouldRun(JobKeys.expiryNotifications)) return;
    try {
      await this.notifications.sendExpirySummaries();
    } catch (e) {
      this.logger.warn(
        `Expiry notifications job failed: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }
}
