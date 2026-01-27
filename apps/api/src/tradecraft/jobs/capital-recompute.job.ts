import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@api/prisma/prisma.service';
import { CapitalService } from '@api/tradecraft/cycles/services/capital.service';
import { JobsGate } from './jobs-gate.service';
import { JobKeys } from './job-keys';

@Injectable()
export class CapitalRecomputeJob {
  private readonly logger = new Logger(CapitalRecomputeJob.name);

  constructor(
    private readonly gate: JobsGate,
    private readonly prisma: PrismaService,
    private readonly capitalService: CapitalService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    if (!this.gate.shouldRun(JobKeys.capitalRecompute)) return;
    try {
      const openCycles = await this.prisma.cycle.findMany({
        where: { status: 'OPEN' },
        select: { id: true },
      });
      for (const c of openCycles) {
        await this.capitalService.computeCapital(c.id, { force: true });
      }
      this.logger.log(
        `Capital recompute completed for ${openCycles.length} open cycles`,
      );
    } catch (e) {
      this.logger.warn(
        `Capital recompute failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}
