import { Test, TestingModule } from '@nestjs/testing';
import { ProfitService } from './profit.service';
import { PrismaService } from '@api/prisma/prisma.service';
import { GameDataService } from '@api/game-data/services/game-data.service';

describe('ProfitService', () => {
  let service: ProfitService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfitService,
        {
          provide: PrismaService,
          useValue: {
            cycle: {
              findUniqueOrThrow: jest.fn(),
            },
            cycleLine: {
              findMany: jest.fn(),
            },
            cycleFeeEvent: {
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: GameDataService,
          useValue: {
            getTypeNames: jest.fn(() =>
              Promise.resolve(new Map<number, string>()),
            ),
            getStationNames: jest.fn(() =>
              Promise.resolve(new Map<number, string>()),
            ),
          },
        },
      ],
    }).compile();

    service = module.get<ProfitService>(ProfitService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('computeCycleProfit', () => {
    it('returns an empty profit breakdown when a cycle has no lines or fees', async () => {
      jest.spyOn(prisma.cycleLine, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.cycleFeeEvent, 'findMany').mockResolvedValue([]);

      const result = await service.computeCycleProfit('cycle-empty');

      expect(result).toEqual({
        lineProfitExclTransport: '0.00',
        transportFees: '0.00',
        cycleProfitCash: '0.00',
        lineBreakdown: [],
      });
    });
  });
});
