import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  NpcMarketCompareAdam4EveQueryDto,
  NpcMarketDailyAggregatesQueryDto,
  NpcMarketSnapshotLatestQueryDto,
  NpcMarketSnapshotTypesQueryDto,
} from '../src/tradecraft/npc-market/dto/npc-market.dto';
import {
  SelfMarketDailyAggregatesQueryDto,
  SelfMarketSnapshotLatestQueryDto,
  SelfMarketSnapshotTypeSummaryQueryDto,
} from '../src/tradecraft/market/dto/self-market.dto';

async function expectValid(instance: object) {
  const errors = await validate(instance);
  expect(errors).toEqual([]);
}

describe('market DTO limit clamping', () => {
  it('clamps NPC market limits before validation', async () => {
    const latest = plainToInstance(NpcMarketSnapshotLatestQueryDto, {
      limit: '999999',
    });
    const types = plainToInstance(NpcMarketSnapshotTypesQueryDto, {
      limitTypes: '999999',
    });
    const daily = plainToInstance(NpcMarketDailyAggregatesQueryDto, {
      limit: '999999',
    });
    const compare = plainToInstance(NpcMarketCompareAdam4EveQueryDto, {
      limit: '999999',
    });

    expect(latest.limit).toBe(50000);
    expect(types.limitTypes).toBe(5000);
    expect(daily.limit).toBe(5000);
    expect(compare.limit).toBe(2000);
    await Promise.all([
      expectValid(latest),
      expectValid(types),
      expectValid(daily),
      expectValid(compare),
    ]);
  });

  it('clamps self-market limits before validation', async () => {
    const latest = plainToInstance(SelfMarketSnapshotLatestQueryDto, {
      limit: '999999',
    });
    const types = plainToInstance(SelfMarketSnapshotTypeSummaryQueryDto, {
      limitTypes: '999999',
    });
    const daily = plainToInstance(SelfMarketDailyAggregatesQueryDto, {
      limit: '999999',
    });

    expect(latest.limit).toBe(5000);
    expect(types.limitTypes).toBe(5000);
    expect(daily.limit).toBe(5000);
    await Promise.all([
      expectValid(latest),
      expectValid(types),
      expectValid(daily),
    ]);
  });
});
