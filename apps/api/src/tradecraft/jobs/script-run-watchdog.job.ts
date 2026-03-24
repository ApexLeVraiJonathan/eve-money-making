import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@api/prisma/prisma.service';
import { NotificationService } from '@api/notifications/notification.service';
import { AppConfig } from '@api/common/config';
import { JobsGate } from './jobs-gate.service';
import { JobKeys } from './job-keys';

const WATCHDOG_TIMEZONE = 'America/Toronto';
const WATCHDOG_SLOTS = [
  { hour: 8, minute: 0, label: '08:00' },
  { hour: 16, minute: 0, label: '16:00' },
  { hour: 0, minute: 0, label: '00:00' },
] as const;

@Injectable()
export class ScriptRunWatchdogJob {
  private readonly logger = new Logger(ScriptRunWatchdogJob.name);
  private readonly tzPartsFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: WATCHDOG_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  constructor(
    private readonly gate: JobsGate,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  private getZonedParts(date: Date): {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  } {
    const parts = this.tzPartsFormatter.formatToParts(date);
    const pick = (type: string): number => {
      const raw = parts.find((p) => p.type === type)?.value ?? '0';
      return Number(raw);
    };
    return {
      year: pick('year'),
      month: pick('month'),
      day: pick('day'),
      hour: pick('hour'),
      minute: pick('minute'),
      second: pick('second'),
    };
  }

  private zonedLocalToUtcDate(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second = 0,
  ): Date {
    // Iteratively solve UTC instant that formats to target local time in WATCHDOG_TIMEZONE.
    let guess = new Date(Date.UTC(year, month - 1, day, hour, minute, second, 0));
    for (let i = 0; i < 6; i++) {
      const z = this.getZonedParts(guess);
      const actualMs = Date.UTC(
        z.year,
        z.month - 1,
        z.day,
        z.hour,
        z.minute,
        z.second,
      );
      const targetMs = Date.UTC(year, month - 1, day, hour, minute, second);
      const diffMs = actualMs - targetMs;
      if (diffMs === 0) break;
      guess = new Date(guess.getTime() - diffMs);
    }
    return guess;
  }

  @Cron('* * * * *')
  async run(): Promise<void> {
    if (!this.gate.shouldRun(JobKeys.scriptRunWatchdog)) return;

    const cfg = AppConfig.scriptRunWatchdog();
    if (!cfg.notifyUserId) return;

    const now = new Date();
    const zonedNow = this.getZonedParts(now);
    const zonedDateLabel = `${String(zonedNow.year).padStart(4, '0')}-${String(
      zonedNow.month,
    ).padStart(2, '0')}-${String(zonedNow.day).padStart(2, '0')}`;

    for (const slot of WATCHDOG_SLOTS) {
      const scheduledAt = this.zonedLocalToUtcDate(
        zonedNow.year,
        zonedNow.month,
        zonedNow.day,
        slot.hour,
        slot.minute,
        0,
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
          `No /pricing/script/confirm-batch call detected for expected slot ${zonedDateLabel} ${slot.label} (${WATCHDOG_TIMEZONE}).`,
          `Checked UTC window: ${scheduledAt.toISOString()} -> ${lateAt.toISOString()}`,
          `Grace window: ${cfg.graceMinutes} minutes`,
          latest
            ? `Latest confirm-batch: ${latest.createdAt.toISOString()} (${latest.idempotencyKey})`
            : 'Latest confirm-batch: none found',
        ],
      });
      this.logger.warn(
        `Late script run alert sent for slot ${zonedDateLabel} ${slot.label} (${WATCHDOG_TIMEZONE})`,
      );
    }
  }
}
