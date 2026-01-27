import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@api/prisma/prisma.service';
import { NotificationService } from '@api/notifications/notification.service';
import { SkillFarmService } from '@api/skill-farm/skill-farm.service';
import { JobsGate } from './jobs-gate.service';
import { JobKeys } from './job-keys';

// Local minimal type to avoid importing ESM-only api-contracts from this CJS build.
type SkillFarmTrackingEntry = {
  characterId: number;
  fullExtractorsReady: number;
  queueSecondsRemaining: number;
  queueStatus: 'OK' | 'WARNING' | 'URGENT' | 'EMPTY';
};

@Injectable()
export class SkillFarmNotificationsJob {
  private readonly logger = new Logger(SkillFarmNotificationsJob.name);

  constructor(
    private readonly gate: JobsGate,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly skillFarm: SkillFarmService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    if (!this.gate.shouldRun(JobKeys.skillFarmNotifications)) return;

    try {
      const configs = await this.prisma.skillFarmCharacterConfig.findMany({
        where: { isActiveFarm: true, includeInNotifications: true },
        include: {
          user: { select: { id: true } },
          character: { select: { id: true, name: true } },
        },
      });

      for (const cfg of configs) {
        const userId = cfg.userId;
        const characterId = cfg.characterId;
        const characterName = cfg.character.name;

        const tracking = await this.skillFarm.getTrackingSnapshot(userId);
        const entry = tracking.characters.find(
          (c: SkillFarmTrackingEntry) => c.characterId === characterId,
        );
        if (!entry) continue;

        // Extractor-ready notifications
        if (entry.fullExtractorsReady > 0) {
          await this.notifications.notifySkillFarmExtractorReady({
            userId,
            characterName,
            injectorsReady: entry.fullExtractorsReady,
          });
        }

        // Queue low notifications
        const hoursRemaining = entry.queueSecondsRemaining / 3600;
        if (
          entry.queueStatus === 'WARNING' ||
          entry.queueStatus === 'URGENT' ||
          entry.queueStatus === 'EMPTY'
        ) {
          await this.notifications.notifySkillFarmQueueLow({
            userId,
            characterName,
            status: entry.queueStatus,
            queueHoursRemaining: hoursRemaining,
          });
        }
      }
    } catch (e) {
      this.logger.warn(
        `Skill farm notifications job failed: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }
}
