import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ImportService } from '../import/import.service';
import { WalletService } from '../wallet/wallet.service';
import { ReconciliationService } from '../reconciliation/reconciliation.service';

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
    private readonly imports: ImportService,
    private readonly wallets: WalletService,
    private readonly recon: ReconciliationService,
  ) {}

  private jobsEnabled(): boolean {
    const flag = process.env.ENABLE_JOBS;
    if (flag !== undefined) {
      return flag === 'true' || flag === '1' || flag === 'yes';
    }
    return process.env.NODE_ENV === 'production';
  }

  @Cron(CronExpression.EVERY_HOUR)
  async runEsiCacheCleanup(): Promise<void> {
    if (!this.jobsEnabled()) {
      this.logger.debug('Skipping ESI cache cleanup (jobs disabled)');
      return;
    }
    await this.cleanupExpiredEsiCache().catch((e) =>
      this.logger.warn(
        `ESI cache cleanup failed: ${e instanceof Error ? e.message : String(e)}`,
      ),
    );
  }

  @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async runDailyImports(): Promise<void> {
    if (!this.jobsEnabled()) {
      this.logger.debug('Skipping daily imports (jobs disabled)');
      return;
    }
    try {
      const { missing } = await this.imports.importMissingMarketOrderTrades(15);
      this.logger.log(
        `Daily import finished; missing processed=${missing.length}`,
      );
    } catch (e) {
      this.logger.warn(
        `Daily import failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async runWalletImportsAndReconcile(): Promise<void> {
    if (!this.jobsEnabled()) {
      this.logger.debug('Skipping wallets import/reconcile (jobs disabled)');
      return;
    }
    try {
      await this.wallets.importAllLinked();
      await this.recon.reconcileFromWalletStrict(null);
      this.logger.log('Hourly wallets import and reconcile completed');
    } catch (e) {
      this.logger.warn(
        `Hourly wallets/reconcile failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  async cleanupExpiredEsiCache(): Promise<{ deleted: number }> {
    const now = new Date();
    const res = await this.prisma.esiCacheEntry.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    this.logger.log(`ESI cache cleanup: deleted=${res.count}`);
    return { deleted: res.count };
  }
  /**
   * Computes staleness (missing daily market files) for last N days.
   */
  async backfillMissingTrades(
    daysBack: number,
  ): Promise<{ missing: string[] }> {
    const dates = this.getLastNDates(daysBack);
    const missing: string[] = [];
    for (const date of dates) {
      const dayStart = new Date(`${date}T00:00:00.000Z`);
      const count = await this.prisma.marketOrderTradeDaily.count({
        where: { scanDate: dayStart },
      });
      if (count === 0) missing.push(date);
    }
    return { missing };
  }

  private getLastNDates(n: number): string[] {
    const dates: string[] = [];
    const today = new Date();
    for (let i = 1; i <= n; i++) {
      const d = new Date(
        Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth(),
          today.getUTCDate(),
        ),
      );
      d.setUTCDate(d.getUTCDate() - i);
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      dates.push(`${yyyy}-${mm}-${dd}`);
    }
    return dates;
  }
}
