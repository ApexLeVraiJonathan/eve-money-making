import { Injectable } from '@nestjs/common';
import { PrismaService } from '@api/prisma/prisma.service';

@Injectable()
export class TradeStalenessService {
  constructor(private readonly prisma: PrismaService) {}

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
        // Treat a day as present if we have at least the conservative mode rows.
        where: { scanDate: dayStart, hasGone: false },
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
