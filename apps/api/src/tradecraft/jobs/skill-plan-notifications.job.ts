import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@api/prisma/prisma.service';
import { NotificationService } from '@api/notifications/notification.service';
import { SkillPlansService } from '@api/skill-plans/skill-plans.service';
import { JobsGate } from './jobs-gate.service';
import { JobKeys } from './job-keys';

@Injectable()
export class SkillPlanNotificationsJob {
  private readonly logger = new Logger(SkillPlanNotificationsJob.name);

  constructor(
    private readonly gate: JobsGate,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly skillPlans: SkillPlansService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    if (!this.gate.shouldRun(JobKeys.skillPlanNotifications)) return;

    try {
      const assignments = await this.prisma.skillPlanAssignment.findMany({
        include: {
          skillPlan: {
            select: { id: true, name: true, userId: true, config: true },
          },
          character: {
            select: { id: true, name: true, userId: true },
          },
        },
      });

      const now = new Date();

      for (const assignment of assignments) {
        const { skillPlan, character } = assignment;
        if (!skillPlan || !character || skillPlan.userId !== character.userId) {
          continue;
        }

        const userId = skillPlan.userId;
        const characterId = character.id;
        const planId = skillPlan.id;

        const progress = await this.skillPlans.getPlanProgressForCharacter(
          userId,
          planId,
          characterId,
        );

        const completionAt = new Date(
          now.getTime() + progress.remainingSeconds * 1000,
        );

        const offsets: Array<{ label: '3d' | '1d' | '1h'; ms: number }> = [
          { label: '3d', ms: 3 * 24 * 60 * 60 * 1000 },
          { label: '1d', ms: 24 * 60 * 60 * 1000 },
          { label: '1h', ms: 60 * 60 * 1000 },
        ];

        const settings = (assignment.settings ?? {}) as {
          sentNotifications?: {
            completion?: Record<string, boolean>;
          };
        };
        settings.sentNotifications ??= {};
        settings.sentNotifications.completion ??= {};

        for (const offset of offsets) {
          const eventTime = new Date(completionAt.getTime() - offset.ms);
          if (eventTime <= now) {
            // Window has passed; skip if we already sent or it's too late.
            continue;
          }

          const diff = eventTime.getTime() - now.getTime();
          if (diff <= 60 * 60 * 1000) {
            const key = offset.label;
            if (!settings.sentNotifications.completion[key]) {
              await this.notifications.notifySkillPlanCompletion({
                userId,
                characterName: character.name,
                planName: skillPlan.name,
                completionAt,
                remainingSeconds: progress.remainingSeconds,
              });
              settings.sentNotifications.completion[key] = true;
            }
          }
        }

        await this.prisma.skillPlanAssignment.update({
          where: { id: assignment.id },
          data: { settings },
        });
      }
    } catch (e) {
      this.logger.warn(
        `Skill plan notifications job failed: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }
}
