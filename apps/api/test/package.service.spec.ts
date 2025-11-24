import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { PackageService } from '../src/market/services/package.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('PackageService.markPackageFailed', () => {
  let service: PackageService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(async (cb: (tx: any) => Promise<unknown>) =>
        cb(prisma),
      ),
      committedPackage: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      packageCycleLine: {
        deleteMany: jest.fn(),
      },
      cycleLine: {
        update: jest.fn(),
        delete: jest.fn(),
      },
      cycleFeeEvent: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PackageService,
        Logger,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PackageService>(PackageService);
  });

  it('reduces cycle line fully and deletes it when there are no sales', async () => {
    prisma.committedPackage.findUnique.mockResolvedValue({
      id: 'pkg1',
      cycleId: 'cycle1',
      status: 'active',
      packageIndex: 1,
      cycleLineLinks: [
        {
          id: 'link1',
          unitsCommitted: 80,
          cycleLine: {
            id: 'cl1',
            typeId: 123,
            plannedUnits: 80,
            unitsBought: 80,
            unitsSold: 0,
            buyCostIsk: '800.00',
          },
        },
      ],
      items: [
        {
          id: 'item1',
          typeId: 123,
          typeName: 'Test Item',
          units: 80,
          unitCost: '10.00',
          unitProfit: '2.00',
        },
      ],
    });

    prisma.committedPackage.update.mockResolvedValue({
      id: 'pkg1',
      status: 'failed',
      failedAt: new Date(),
      collateralRecoveredIsk: '900.00',
    });

    await service.markPackageFailed({
      packageId: 'pkg1',
      collateralRecoveredIsk: '900.00',
    });

    // Junction should be removed
    expect(prisma.packageCycleLine.deleteMany).toHaveBeenCalledWith({
      where: { id: 'link1' },
    });

    // Cycle line should be deleted because all units were unsold and removed
    expect(prisma.cycleLine.delete).toHaveBeenCalledWith({
      where: { id: 'cl1' },
    });

    // Cost reduction should be 80 * 10 = 800, profit 100 => negative fee 100
    expect(prisma.cycleFeeEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        feeType: 'collateral_recovery',
        amountIsk: '-100.00',
      }),
    });
  });

  it('only removes unsold units when some units are already sold', async () => {
    prisma.committedPackage.findUnique.mockResolvedValue({
      id: 'pkg2',
      cycleId: 'cycle1',
      status: 'active',
      packageIndex: 2,
      cycleLineLinks: [
        {
          id: 'link1',
          unitsCommitted: 60,
          cycleLine: {
            id: 'cl1',
            typeId: 123,
            plannedUnits: 100,
            unitsBought: 100,
            unitsSold: 40,
            buyCostIsk: '1000.00',
          },
        },
      ],
      items: [
        {
          id: 'item1',
          typeId: 123,
          typeName: 'Test Item',
          units: 60,
          unitCost: '10.00',
          unitProfit: '2.00',
        },
      ],
    });

    prisma.committedPackage.update.mockResolvedValue({
      id: 'pkg2',
      status: 'failed',
      failedAt: new Date(),
      collateralRecoveredIsk: '900.00',
    });

    await service.markPackageFailed({
      packageId: 'pkg2',
      collateralRecoveredIsk: '900.00',
    });

    // Junction removed
    expect(prisma.packageCycleLine.deleteMany).toHaveBeenCalledWith({
      where: { id: 'link1' },
    });

    // Line should be updated, not deleted
    expect(prisma.cycleLine.delete).not.toHaveBeenCalled();

    expect(prisma.cycleLine.update).toHaveBeenCalledWith({
      where: { id: 'cl1' },
      data: {
        // 100 - 60 removed = 40, but cannot go below unitsSold=40
        unitsBought: 40,
        plannedUnits: 40,
        buyCostIsk: '400.00',
      },
    });
  });

  it('skips quantity updates when all units are already sold', async () => {
    prisma.committedPackage.findUnique.mockResolvedValue({
      id: 'pkg3',
      cycleId: 'cycle1',
      status: 'active',
      packageIndex: 3,
      cycleLineLinks: [
        {
          id: 'link1',
          unitsCommitted: 50,
          cycleLine: {
            id: 'cl1',
            typeId: 123,
            plannedUnits: 50,
            unitsBought: 50,
            unitsSold: 50,
            buyCostIsk: '500.00',
          },
        },
      ],
      items: [
        {
          id: 'item1',
          typeId: 123,
          typeName: 'Test Item',
          units: 50,
          unitCost: '10.00',
          unitProfit: '2.00',
        },
      ],
    });

    prisma.committedPackage.update.mockResolvedValue({
      id: 'pkg3',
      status: 'failed',
      failedAt: new Date(),
      collateralRecoveredIsk: '600.00',
    });

    await service.markPackageFailed({
      packageId: 'pkg3',
      collateralRecoveredIsk: '600.00',
    });

    // Junction removed but cycle line left untouched
    expect(prisma.packageCycleLine.deleteMany).toHaveBeenCalledWith({
      where: { id: 'link1' },
    });

    expect(prisma.cycleLine.update).not.toHaveBeenCalled();
    expect(prisma.cycleLine.delete).not.toHaveBeenCalled();
  });
});
