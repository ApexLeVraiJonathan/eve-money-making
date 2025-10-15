import { Test, TestingModule } from '@nestjs/testing';
import { AllocationService } from '../src/reconciliation/allocation.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { Logger } from '@nestjs/common';

describe('AllocationService', () => {
  let service: AllocationService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AllocationService,
        {
          provide: PrismaService,
          useValue: {
            cycleLine: {
              findMany: jest.fn(),
              update: jest.fn(),
            },
            walletTransaction: {
              findMany: jest.fn(),
            },
            buyAllocation: {
              create: jest.fn(),
              aggregate: jest.fn(),
            },
            sellAllocation: {
              create: jest.fn(),
              aggregate: jest.fn(),
            },
            eveCharacter: {
              findMany: jest.fn(),
            },
            cycle: {
              findFirst: jest.fn(),
            },
          },
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AllocationService>(AllocationService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('allocateBuys', () => {
    it('should allocate a simple buy transaction FIFO', async () => {
      const cycleId = 'test-cycle-id';

      // Mock cycle lookup
      jest.spyOn(prisma.cycle, 'findFirst').mockResolvedValue({
        id: cycleId,
      } as any);

      // Mock SELLER characters (for sells, but needed by allocateAll)
      jest.spyOn(prisma.eveCharacter, 'findMany').mockResolvedValue([]);

      // Mock cycle lines (called twice: once for buys, once for sells)
      jest.spyOn(prisma.cycleLine, 'findMany').mockResolvedValue([
        {
          id: 'line-1',
          typeId: 34,
          destinationStationId: 60011866,
          plannedUnits: 100,
          unitsBought: 0,
          unitsSold: 0,
          buyCostIsk: '0',
          salesGrossIsk: '0',
          salesTaxIsk: '0',
          salesNetIsk: '0',
        },
      ] as any);

      // Mock wallet transactions (called twice: once for buys, once for sells)
      let callCount = 0;
      jest
        .spyOn(prisma.walletTransaction, 'findMany')
        .mockImplementation((args: any) => {
          callCount++;
          if (args.where.isBuy === true) {
            // Buy transactions
            return Promise.resolve([
              {
                characterId: 1,
                transactionId: BigInt(1001),
                typeId: 34,
                quantity: 50,
                unitPrice: '1000.00',
              },
            ] as any);
          } else {
            // Sell transactions
            return Promise.resolve([]);
          }
        });

      // Mock existing allocations (none)
      jest.spyOn(prisma.buyAllocation, 'aggregate').mockResolvedValue({
        _sum: { quantity: null },
      } as any);
      jest.spyOn(prisma.sellAllocation, 'aggregate').mockResolvedValue({
        _sum: { quantity: null },
      } as any);

      // Mock allocation creation
      const createBuySpy = jest
        .spyOn(prisma.buyAllocation, 'create')
        .mockResolvedValue({} as any);

      // Mock line update
      const updateSpy = jest
        .spyOn(prisma.cycleLine, 'update')
        .mockResolvedValue({} as any);

      // Run allocation
      const result = await service.allocateAll(cycleId);

      // Verify buy allocation was created
      expect(createBuySpy).toHaveBeenCalledWith({
        data: {
          walletCharacterId: 1,
          walletTransactionId: BigInt(1001),
          lineId: 'line-1',
          quantity: 50,
          unitPrice: '1000.00',
        },
      });

      // Verify line was updated
      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: 'line-1' },
        data: {
          unitsBought: 50,
          buyCostIsk: '50000.00',
        },
      });
    });
  });

  describe('allocateSells', () => {
    it('should match sells by character location', async () => {
      const cycleId = 'test-cycle-id';

      // Mock cycle lookup
      jest.spyOn(prisma.cycle, 'findFirst').mockResolvedValue({
        id: cycleId,
      } as any);

      // Mock SELLER characters
      jest.spyOn(prisma.eveCharacter, 'findMany').mockResolvedValue([
        {
          id: 1,
          location: 'DODIXIE',
        },
      ] as any);

      // Mock cycle lines (called twice: once for buys, once for sells)
      jest.spyOn(prisma.cycleLine, 'findMany').mockResolvedValue([
        {
          id: 'line-1',
          typeId: 34,
          destinationStationId: 60011866, // Dodixie
          plannedUnits: 100,
          unitsBought: 100,
          unitsSold: 0,
          buyCostIsk: '0',
          salesGrossIsk: '0',
          salesTaxIsk: '0',
          salesNetIsk: '0',
        },
      ] as any);

      // Mock wallet transactions (buys and sells)
      jest
        .spyOn(prisma.walletTransaction, 'findMany')
        .mockImplementation((args: any) => {
          if (args.where.isBuy === true) {
            // No buy transactions
            return Promise.resolve([]);
          } else {
            // Sell transactions
            return Promise.resolve([
              {
                characterId: 1,
                transactionId: BigInt(2001),
                typeId: 34,
                quantity: 20,
                unitPrice: '1500.00',
              },
            ] as any);
          }
        });

      // Mock existing allocations (none)
      jest.spyOn(prisma.buyAllocation, 'aggregate').mockResolvedValue({
        _sum: { quantity: null },
      } as any);
      jest.spyOn(prisma.sellAllocation, 'aggregate').mockResolvedValue({
        _sum: { quantity: null },
      } as any);

      // Mock allocation creation
      const createSpy = jest
        .spyOn(prisma.sellAllocation, 'create')
        .mockResolvedValue({} as any);

      // Mock line update
      const updateSpy = jest
        .spyOn(prisma.cycleLine, 'update')
        .mockResolvedValue({} as any);

      // Run allocation
      const result = await service.allocateAll(cycleId);

      // Verify sell allocation was created
      expect(createSpy).toHaveBeenCalled();
      const callArgs = createSpy.mock.calls[0][0];
      expect(callArgs.data).toMatchObject({
        walletCharacterId: 1,
        walletTransactionId: BigInt(2001),
        lineId: 'line-1',
        quantity: 20,
        unitPrice: '1500.00',
      });

      // Verify tax calculation (3.37% of 30000 = 1011)
      const revenue = 20 * 1500;
      const expectedTax = revenue * 0.0337;
      expect(Number(callArgs.data.taxIsk)).toBeCloseTo(expectedTax, 2);

      // Verify line was updated
      expect(updateSpy).toHaveBeenCalled();
    });
  });
});
