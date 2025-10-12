import { Test } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { LiquidityService } from '../src/liquidity/liquidity.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { DataImportService } from '@shared/data-import';

describe('LiquidityService (unit-ish)', () => {
  it('filters items by coverage, isk, and trades thresholds', async () => {
    const dates = [
      '2025-10-01',
      '2025-10-02',
      '2025-10-03',
      '2025-10-04',
      '2025-10-05',
      '2025-10-06',
      '2025-10-07',
    ];
    const prismaMock = {
      trackedStation: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { stationId: 60003760, station: { name: 'Jita IV-4' } },
          ]),
      },
      stationId: {
        findUnique: jest.fn().mockResolvedValue({ name: 'Jita IV-4' }),
      },
      marketOrderTradeDaily: {
        findMany: jest.fn().mockResolvedValue(
          dates.flatMap((d, i) => [
            {
              typeId: 34,
              scanDate: new Date(`${d}T00:00:00.000Z`),
              amount: 100 + i,
              iskValue: { toString: () => String(1_500_000) } as any,
              high: { toString: () => '8.00' } as any,
              low: { toString: () => '6.00' } as any,
              avg: { toString: () => '7.00' } as any,
              orderNum: 5,
              type: { name: 'Tritanium' },
              isBuyOrder: false,
              locationId: 60003760,
            },
          ]),
        ),
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [LiquidityService, PrismaService, DataImportService, Logger],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(DataImportService)
      .useValue({ getLastNDates: () => dates })
      .compile();

    const svc = moduleRef.get(LiquidityService);
    const res = await svc.runCheck({
      windowDays: 7,
      minCoverageRatio: 0.5,
      minLiquidityThresholdISK: 1_000_000,
      minWindowTrades: 3,
    });
    const jita = res['60003760'];
    expect(jita.stationName).toBe('Jita IV-4');
    expect(jita.totalItems).toBeGreaterThanOrEqual(1);
    expect(jita.items[0]?.typeName).toBe('Tritanium');
  });
});
