import { Test } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { LedgerService } from '../src/ledger/ledger.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { EsiCharactersService } from '../src/esi/esi-characters.service';
import { EsiService } from '../src/esi/esi.service';

describe('LedgerService (unit-ish)', () => {
  it('computeNav sums entry types correctly with cents precision', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        LedgerService,
        PrismaService,
        EsiCharactersService,
        EsiService,
        Logger,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({
        cycleLedgerEntry: {
          findMany: jest.fn().mockResolvedValue([
            { entryType: 'deposit', amount: '100.00' },
            { entryType: 'withdrawal', amount: '40.50' },
            { entryType: 'fee', amount: '5.25' },
            { entryType: 'execution', amount: '10.25' },
          ]),
        },
      })
      .overrideProvider(EsiService)
      .useValue({})
      .overrideProvider(EsiCharactersService)
      .useValue({})
      .compile();

    const svc = moduleRef.get(LedgerService);
    const nav = await svc.computeNav('cycle-1');
    expect(nav.deposits).toBe('100.00');
    expect(nav.withdrawals).toBe('40.50');
    expect(nav.fees).toBe('5.25');
    expect(nav.executions).toBe('10.25');
    expect(nav.net).toBe('64.50');
  });
});
