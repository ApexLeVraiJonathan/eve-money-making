import { Injectable } from '@nestjs/common';
import { AppConfig } from '@api/common/config';
import { PrismaService } from '@api/prisma/prisma.service';
import type { MarketDataReadinessResponse } from '@eve/shared/tradecraft-market';
import { MarketDataHealthService } from './market-data-health.service';

type ReadinessStatus = MarketDataReadinessResponse['status'];

@Injectable()
export class MarketDataReadinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly health: MarketDataHealthService,
  ) {}

  async getReadiness(): Promise<MarketDataReadinessResponse> {
    const cfg = AppConfig.marketDataReadiness();
    const requiredDays = cfg.requiredHealthyDays;
    const validationStart = this.parseDay(cfg.validationStartDate);
    const today = this.utcDayStart(new Date());
    const eligibleOn = this.addDays(validationStart, requiredDays - 1);
    const evaluatedStart =
      eligibleOn.getTime() <= today.getTime()
        ? this.addDays(today, -(requiredDays - 1))
        : validationStart;
    const elapsedDays =
      today.getTime() < validationStart.getTime()
        ? 0
        : Math.floor(
            (today.getTime() - validationStart.getTime()) / 86_400_000,
          ) + 1;

    const startDate = this.formatDay(evaluatedStart);
    const endDate = this.formatDay(today);
    const stationId = AppConfig.marketNpcGather().stationId;

    const [health, adam4eveReference, anomalyCounts] = await Promise.all([
      this.health.getHealth({ startDate, endDate }),
      this.buildAdam4EveReference(stationId, evaluatedStart, today),
      this.buildAnomalyCounts(evaluatedStart, today),
    ]);

    const npcHealth = health.sources.find((source) => source.source === 'npc');
    const selfHealth = health.sources.find((source) => source.source === 'self');
    const scanWarnings = health.sources.flatMap((source) =>
      source.warnings.map((warning) => `${source.label}: ${warning}`),
    );
    const newSignalOk = elapsedDays >= requiredDays;
    const scanHealthOk =
      npcHealth?.status === 'healthy' && selfHealth?.status === 'healthy';
    const adamOk =
      adam4eveReference.npcRows > 0 &&
      adam4eveReference.adamRows > 0 &&
      adam4eveReference.missingNpcRatio <= 0.05;

    const reasons: string[] = [];
    if (!newSignalOk) {
      reasons.push(
        `Need ${requiredDays} days of new validation signals; ${elapsedDays} day(s) are available since ${this.formatDay(validationStart)}.`,
      );
    }
    if (!scanHealthOk) {
      reasons.push(
        `Scan health is ${npcHealth?.status ?? 'missing'} for NPC and ${selfHealth?.status ?? 'missing'} for self-market.`,
      );
    }
    if (!adamOk) {
      reasons.push(
        `NPC vs Adam4EVE reference coverage is not strong enough yet (${adam4eveReference.missingNpc} missing local key(s) of ${adam4eveReference.unionKeys}).`,
      );
    }
    if (anomalyCounts.severe > 0) {
      reasons.push(
        `${anomalyCounts.severe} severe market price anomaly/anomalies were recorded in the evaluation window.`,
      );
    }
    if (anomalyCounts.borderline > 0) {
      reasons.push(
        `${anomalyCounts.borderline} borderline anomaly/anomalies were recorded and should be watched.`,
      );
    }
    if (reasons.length === 0) {
      reasons.push('All current validation gates are healthy for the evaluated window.');
    }

    const status = this.resolveStatus({
      newSignalOk,
      scanHealthOk,
      adamOk,
      anomalyCounts,
      scanWarnings,
    });

    return {
      generatedAt: new Date().toISOString(),
      status,
      label: this.labelFor(status),
      validationWindow: {
        requiredDays,
        validationStartDate: this.formatDay(validationStart),
        eligibleOn: this.formatDay(eligibleOn),
        evaluatedStartDate: startDate,
        evaluatedEndDate: endDate,
        elapsedDays,
      },
      reasons,
      checks: {
        newSignalGate: {
          ok: newSignalOk,
          detail: newSignalOk
            ? `${elapsedDays} day(s) of new validation signals are available.`
            : `Ready candidate is gated until ${this.formatDay(eligibleOn)}.`,
        },
        scanHealth: {
          ok: scanHealthOk,
          npcStatus: npcHealth?.status ?? 'missing',
          selfStatus: selfHealth?.status ?? 'missing',
          warnings: scanWarnings,
        },
        adam4eveReference: {
          ok: adamOk,
          stationId,
          note:
            'Adam4EVE is treated as a reference signal for NPC markets only, not ground truth.',
          ...adam4eveReference,
        },
        anomalies: anomalyCounts,
      },
    };
  }

  private async buildAdam4EveReference(
    stationId: number,
    start: Date,
    end: Date,
  ): Promise<
    Omit<
      MarketDataReadinessResponse['checks']['adam4eveReference'],
      'ok' | 'stationId' | 'note'
    >
  > {
    const [npcRows, adamRows] = await Promise.all([
      this.prisma.npcMarketOrderTradeDaily.findMany({
        where: { stationId, scanDate: { gte: start, lte: end } },
        select: {
          scanDate: true,
          typeId: true,
          isBuyOrder: true,
          hasGone: true,
        },
      }),
      this.prisma.marketOrderTradeDaily.findMany({
        where: { locationId: stationId, scanDate: { gte: start, lte: end } },
        select: {
          scanDate: true,
          typeId: true,
          isBuyOrder: true,
          hasGone: true,
        },
      }),
    ]);
    const npcKeys = new Set(
      npcRows.map((row) =>
        this.keyOf(row.scanDate, row.typeId, row.isBuyOrder, row.hasGone),
      ),
    );
    const adamKeys = new Set(
      adamRows.map((row) =>
        this.keyOf(row.scanDate, row.typeId, row.isBuyOrder, row.hasGone),
      ),
    );
    const allKeys = new Set([...npcKeys, ...adamKeys]);
    let missingNpc = 0;
    let missingAdam = 0;
    for (const key of allKeys) {
      if (!npcKeys.has(key)) missingNpc += 1;
      if (!adamKeys.has(key)) missingAdam += 1;
    }

    return {
      npcRows: npcRows.length,
      adamRows: adamRows.length,
      unionKeys: allKeys.size,
      missingNpc,
      missingAdam,
      missingNpcRatio: allKeys.size ? missingNpc / allKeys.size : 1,
    };
  }

  private async buildAnomalyCounts(
    start: Date,
    end: Date,
  ): Promise<MarketDataReadinessResponse['checks']['anomalies']> {
    const nextEnd = this.addDays(end, 1);
    const rows = await this.prisma.marketPriceAnomaly.groupBy({
      by: ['severity'],
      where: { scanObservedAt: { gte: start, lt: nextEnd } },
      _count: { _all: true },
    });
    const bySeverity = Object.fromEntries(
      rows.map((row) => [row.severity, row._count._all]),
    );
    const severe = bySeverity.severe ?? 0;
    const borderline = bySeverity.borderline ?? 0;
    return {
      ok: severe === 0,
      severe,
      borderline,
      total: rows.reduce((sum, row) => sum + row._count._all, 0),
    };
  }

  private resolveStatus(args: {
    newSignalOk: boolean;
    scanHealthOk: boolean;
    adamOk: boolean;
    anomalyCounts: MarketDataReadinessResponse['checks']['anomalies'];
    scanWarnings: string[];
  }): ReadinessStatus {
    if (
      !args.newSignalOk ||
      !args.scanHealthOk ||
      !args.adamOk ||
      args.anomalyCounts.severe > 0
    ) {
      return 'not-ready';
    }
    if (args.anomalyCounts.borderline > 0 || args.scanWarnings.length > 0) {
      return 'watch';
    }
    return 'ready-candidate';
  }

  private labelFor(status: ReadinessStatus): string {
    if (status === 'ready-candidate') return 'Ready candidate';
    if (status === 'watch') return 'Watch';
    return 'Not ready';
  }

  private keyOf(
    scanDate: Date,
    typeId: number,
    isBuyOrder: boolean,
    hasGone: boolean,
  ): string {
    return `${this.formatDay(scanDate)}:${typeId}:${isBuyOrder ? 'B' : 'S'}:${hasGone ? 'G1' : 'G0'}`;
  }

  private parseDay(value: string): Date {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? this.utcDayStart(new Date()) : parsed;
  }

  private utcDayStart(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  private addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * 86_400_000);
  }

  private formatDay(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}
