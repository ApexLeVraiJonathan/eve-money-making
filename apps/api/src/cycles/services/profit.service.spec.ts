import { Test, TestingModule } from '@nestjs/testing';
import { ProfitService } from './profit.service';
import { PrismaService } from '../../prisma/prisma.service';

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

  describe('computeProfitForCycle', () => {
    it('should calculate profit correctly for a closed cycle', async () => {
      const mockCycle = {
        id: 'cycle-1',
        name: 'Test Cycle',
        status: 'CLOSED',
        openedAt: new Date('2024-01-01'),
        closedAt: new Date('2024-01-10'),
        navAtOpen: 1000000n,
        navAtClose: 1500000n,
        totalRevenue: null,
        totalCost: null,
        totalProfit: null,
        totalFees: null,
      };

      const mockLines = [
        {
          id: 'line-1',
          typeId: 34,
          typeName: 'Tritanium',
          buyPrice: 5.5,
          sellPrice: 6.0,
          currentSellPrice: 6.0,
          quantityBought: 1000,
          quantitySold: 900,
          quantityRemaining: 100,
          totalCost: 5500,
          totalRevenue: 5400,
          totalFees: 100,
          profitRealized: -200,
          status: 'ACTIVE',
        },
        {
          id: 'line-2',
          typeId: 35,
          typeName: 'Pyerite',
          buyPrice: 10.0,
          sellPrice: 12.0,
          currentSellPrice: 12.0,
          quantityBought: 500,
          quantitySold: 500,
          quantityRemaining: 0,
          totalCost: 5000,
          totalRevenue: 6000,
          totalFees: 200,
          profitRealized: 800,
          status: 'COMPLETE',
        },
      ];

      jest.spyOn(prisma.cycle, 'findUniqueOrThrow').mockResolvedValue(mockCycle as any);
      jest.spyOn(prisma.cycleLine, 'findMany').mockResolvedValue(mockLines as any);

      const result = await service.computeProfitForCycle('cycle-1');

      expect(result).toMatchObject({
        cycleId: 'cycle-1',
        totalCost: 10500, // 5500 + 5000
        totalRevenue: 11400, // 5400 + 6000
        totalFees: 300, // 100 + 200
        profitRealized: 600, // -200 + 800
        profitUnrealized: expect.any(Number),
        profitTotal: expect.any(Number),
      });
    });

    it('should handle cycles with no lines', async () => {
      const mockCycle = {
        id: 'cycle-2',
        name: 'Empty Cycle',
        status: 'OPEN',
        openedAt: new Date('2024-01-01'),
        closedAt: null,
        navAtOpen: 1000000n,
        navAtClose: null,
        totalRevenue: null,
        totalCost: null,
        totalProfit: null,
        totalFees: null,
      };

      jest.spyOn(prisma.cycle, 'findUniqueOrThrow').mockResolvedValue(mockCycle as any);
      jest.spyOn(prisma.cycleLine, 'findMany').mockResolvedValue([]);

      const result = await service.computeProfitForCycle('cycle-2');

      expect(result).toMatchObject({
        cycleId: 'cycle-2',
        totalCost: 0,
        totalRevenue: 0,
        totalFees: 0,
        profitRealized: 0,
        profitUnrealized: 0,
        profitTotal: 0,
      });
    });

    it('should calculate unrealized profit from remaining inventory', async () => {
      const mockCycle = {
        id: 'cycle-3',
        name: 'Active Cycle',
        status: 'OPEN',
        openedAt: new Date('2024-01-01'),
        closedAt: null,
        navAtOpen: 1000000n,
        navAtClose: null,
        totalRevenue: null,
        totalCost: null,
        totalProfit: null,
        totalFees: null,
      };

      const mockLines = [
        {
          id: 'line-1',
          typeId: 34,
          typeName: 'Tritanium',
          buyPrice: 5.0,
          sellPrice: 7.0,
          currentSellPrice: 7.0,
          quantityBought: 1000,
          quantitySold: 600,
          quantityRemaining: 400,
          totalCost: 5000,
          totalRevenue: 4200,
          totalFees: 100,
          profitRealized: -900,
          status: 'ACTIVE',
        },
      ];

      jest.spyOn(prisma.cycle, 'findUniqueOrThrow').mockResolvedValue(mockCycle as any);
      jest.spyOn(prisma.cycleLine, 'findMany').mockResolvedValue(mockLines as any);

      const result = await service.computeProfitForCycle('cycle-3');

      // Unrealized = (currentSellPrice * remaining) - (buyPrice * remaining)
      // = (7 * 400) - (5 * 400) = 2800 - 2000 = 800
      expect(result.profitUnrealized).toBeCloseTo(800, 1);
      
      // Total = realized + unrealized = -900 + 800 = -100
      expect(result.profitTotal).toBeCloseTo(-100, 1);
    });
  });

  describe('computeROI', () => {
    it('should calculate ROI percentage correctly', () => {
      const roi = service.computeROI(10000, 2000);
      expect(roi).toBe(20); // 2000 / 10000 * 100 = 20%
    });

    it('should return 0 for zero capital', () => {
      const roi = service.computeROI(0, 1000);
      expect(roi).toBe(0);
    });

    it('should handle negative profit', () => {
      const roi = service.computeROI(10000, -1000);
      expect(roi).toBe(-10); // -1000 / 10000 * 100 = -10%
    });
  });
});

