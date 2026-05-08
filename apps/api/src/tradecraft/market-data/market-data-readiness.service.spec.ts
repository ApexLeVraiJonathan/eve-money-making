import { PrismaService } from '@api/prisma/prisma.service';
import { MarketDataHealthService } from './market-data-health.service';
import { MarketDataReadinessService } from './market-data-readiness.service';

describe('MarketDataReadinessService', () => {
  let service: MarketDataReadinessService;
  let prisma: {
    npcMarketOrderTradeDaily: { findMany: jest.Mock };
    marketOrderTradeDaily: { findMany: jest.Mock };
    marketPriceAnomaly: { groupBy: jest.Mock };
  };
  let health: { getHealth: jest.Mock };
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    prisma = {
      npcMarketOrderTradeDaily: { findMany: jest.fn() },
      marketOrderTradeDaily: { findMany: jest.fn() },
      marketPriceAnomaly: { groupBy: jest.fn() },
    };
    health = { getHealth: jest.fn() };
    service = new MarketDataReadinessService(
      prisma as unknown as PrismaService,
      health as unknown as MarketDataHealthService,
    );
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns not ready before the new signal gate has enough days', async () => {
    process.env.MARKET_VALIDATION_START_DATE = formatDay(new Date());
    process.env.MARKET_VALIDATION_REQUIRED_DAYS = '14';
    mockHealthyHealth();
    mockAdamCoverage();
    prisma.marketPriceAnomaly.groupBy.mockResolvedValue([]);

    const result = await service.getReadiness();

    expect(result.status).toBe('not-ready');
    expect(result.checks.newSignalGate.ok).toBe(false);
    expect(result.reasons[0]).toContain('Need 14 days');
  });

  it('returns watch when only borderline anomalies remain', async () => {
    process.env.MARKET_VALIDATION_START_DATE = formatDay(daysAgo(20));
    process.env.MARKET_VALIDATION_REQUIRED_DAYS = '14';
    mockHealthyHealth();
    mockAdamCoverage();
    prisma.marketPriceAnomaly.groupBy.mockResolvedValue([
      { severity: 'borderline', _count: { _all: 2 } },
    ]);

    const result = await service.getReadiness();

    expect(result.status).toBe('watch');
    expect(result.checks.anomalies.borderline).toBe(2);
    expect(result.checks.anomalies.ok).toBe(true);
  });

  it('returns ready candidate when all readiness checks are healthy', async () => {
    process.env.MARKET_VALIDATION_START_DATE = formatDay(daysAgo(20));
    process.env.MARKET_VALIDATION_REQUIRED_DAYS = '14';
    mockHealthyHealth();
    mockAdamCoverage();
    prisma.marketPriceAnomaly.groupBy.mockResolvedValue([]);

    const result = await service.getReadiness();

    expect(result.status).toBe('ready-candidate');
    expect(result.checks.scanHealth.ok).toBe(true);
    expect(result.checks.adam4eveReference.ok).toBe(true);
  });

  function mockHealthyHealth() {
    health.getHealth.mockResolvedValue({
      generatedAt: new Date().toISOString(),
      range: { startDate: formatDay(daysAgo(13)), endDate: formatDay(new Date()) },
      sources: [
        {
          source: 'npc',
          label: 'NPC market scans',
          status: 'healthy',
          expectedDays: 14,
          daysWithData: 14,
          missingDays: [],
          successfulRuns: 14,
          failedRuns: 0,
          latestObservedAt: new Date().toISOString(),
          warnings: [],
          days: [],
        },
        {
          source: 'self',
          label: 'Self-market scans',
          status: 'healthy',
          expectedDays: 14,
          daysWithData: 14,
          missingDays: [],
          successfulRuns: null,
          failedRuns: null,
          latestObservedAt: new Date().toISOString(),
          warnings: [],
          days: [],
        },
      ],
    });
  }

  function mockAdamCoverage() {
    const row = {
      scanDate: new Date(),
      typeId: 34,
      isBuyOrder: false,
      hasGone: false,
    };
    prisma.npcMarketOrderTradeDaily.findMany.mockResolvedValue([row]);
    prisma.marketOrderTradeDaily.findMany.mockResolvedValue([row]);
  }
});

function daysAgo(days: number): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}
