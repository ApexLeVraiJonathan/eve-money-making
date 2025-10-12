import { Test } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { PricingService } from '../src/pricing/pricing.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { EsiService } from '../src/esi/esi.service';
import { EsiCharactersService } from '../src/esi/esi-characters.service';

describe('PricingService (unit-ish)', () => {
  it('confirmListing computes listing broker fee from total', async () => {
    const prismaMock = {
      cycle: { findFirst: jest.fn().mockResolvedValue({ id: 'C1' }) },
      cycleLedgerEntry: { create: jest.fn().mockResolvedValue({ id: 'E1' }) },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        PricingService,
        PrismaService,
        EsiService,
        EsiCharactersService,
        Logger,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(EsiService)
      .useValue({})
      .overrideProvider(EsiCharactersService)
      .useValue({})
      .compile();

    const svc = moduleRef.get(PricingService);
    const res = await svc.confirmListing({
      planCommitId: 'P1',
      characterId: 1,
      stationId: 60003760,
      items: [
        { typeId: 34, quantity: 10, unitPrice: 5 }, // 50
        { typeId: 35, quantity: 2, unitPrice: 20 }, // 40
      ], // total 90; default broker 1.5% => 1.35
    });
    expect(res.ok).toBe(true);
    expect(res.feeAmountISK).toBe('1.35');
  });
});
