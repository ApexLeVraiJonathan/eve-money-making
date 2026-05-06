import { ParticipationCapsService } from './participation-caps.service';

function createService(overrides?: { prisma?: Record<string, unknown> }) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    jingleYieldProgram: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    ...overrides?.prisma,
  };

  return {
    service: new ParticipationCapsService(prisma as never),
    prisma,
  };
}

describe('ParticipationCapsService', () => {
  it('returns defaults when a user has no custom caps', async () => {
    const { service } = createService();

    await expect(service.getTradecraftCapsForUser('user-1')).resolves.toEqual({
      principalCapIsk: 10_000_000_000,
      maximumCapIsk: 20_000_000_000,
      effectivePrincipalCapIsk: 10_000_000_000,
    });
  });

  it('subtracts active JingleYield principal from effective principal cap', async () => {
    const { service } = createService({
      prisma: {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            tradecraftPrincipalCapIsk: '15000000000',
            tradecraftMaximumCapIsk: '25000000000',
          }),
        },
        jingleYieldProgram: {
          findMany: jest.fn().mockResolvedValue([
            { lockedPrincipalIsk: '4000000000' },
            { lockedPrincipalIsk: '1000000000' },
          ]),
        },
      },
    });

    await expect(service.getTradecraftCapsForUser('user-1')).resolves.toEqual({
      principalCapIsk: 15_000_000_000,
      maximumCapIsk: 25_000_000_000,
      effectivePrincipalCapIsk: 10_000_000_000,
    });
  });
});
