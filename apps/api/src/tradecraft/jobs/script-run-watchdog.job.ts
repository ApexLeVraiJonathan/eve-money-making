import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@api/prisma/prisma.service';
import { NotificationService } from '@api/notifications/notification.service';
import { AppConfig } from '@api/common/config';
import { JobsGate } from './jobs-gate.service';
import { JobKeys } from './job-keys';

@Injectable()
export class ScriptRunWatchdogJob {
  private readonly logger = new Logger(ScriptRunWatchdogJob.name);

  constructor(
    private readonly gate: JobsGate,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  @Cron('* * * * *')
  async run(): Promise<void> {
    if (!this.gate.shouldRun(JobKeys.scriptRunWatchdog)) return;

    const cfg = AppConfig.scriptRunWatchdog();
    if (!cfg.notifyUserId || !cfg.expectedTimesUtc.length) return;

    const now = new Date();
    const todayUtc = now.toISOString().slice(0, 10); // YYYY-MM-DD

    for (const timeStr of cfg.expectedTimesUtc) {
      const [hRaw, mRaw] = timeStr.split(':');
      const hour = Number(hRaw);
      const minute = Number(mRaw);
      if (!Number.isFinite(hour) || !Number.isFinite(minute)) continue;

      const scheduledAt = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          hour,
          minute,
          0,
          0,
        ),
      );
      const lateAt = new Date(scheduledAt.getTime() + cfg.graceMinutes * 60_000);
      const alertUntil = new Date(
        lateAt.getTime() + cfg.alertWindowMinutes * 60_000,
      );

      // Emit at most once per slot/day by using a narrow alert window.
      if (now < lateAt || now >= alertUntil) continue;

      const batchCount = await this.prisma.scriptConfirmBatch.count({
        where: {
          createdAt: {
            gte: scheduledAt,
            lt: lateAt,
          },
        },
      });
      if (batchCount > 0) continue;

      const latest = await this.prisma.scriptConfirmBatch.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, idempotencyKey: true },
      });

      await this.notifications.sendSystemAlertDm({
        userId: cfg.notifyUserId,
        title: 'Script Run Late',
        lines: [
          `No /pricing/script/confirm-batch call detected for expected slot ${todayUtc} ${timeStr} UTC.`,
          `Grace window: ${cfg.graceMinutes} minutes`,
          latest
            ? `Latest confirm-batch: ${latest.createdAt.toISOString()} (${latest.idempotencyKey})`
            : 'Latest confirm-batch: none found',
        ],
      });
      this.logger.warn(
        `Late script run alert sent for slot ${todayUtc} ${timeStr} UTC`,
      );
    }
  }
}
