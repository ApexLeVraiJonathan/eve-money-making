import { NotificationService } from '../src/notifications/notification.service';

describe('Tradecraft notifications', () => {
  const prefs = [
    {
      userId: 'u1',
      channel: 'DISCORD_DM',
      notificationType: 'CYCLE_PLANNED',
      enabled: true,
    },
    {
      userId: 'u2',
      channel: 'DISCORD_DM',
      notificationType: 'CYCLE_PLANNED',
      enabled: true,
    },
    {
      userId: 'u1',
      channel: 'DISCORD_DM',
      notificationType: 'CYCLE_STARTED',
      enabled: true,
    },
    {
      userId: 'u2',
      channel: 'DISCORD_DM',
      notificationType: 'CYCLE_STARTED',
      enabled: true,
    },
    // Results and payout are typically participant-only; keep one user enabled
    {
      userId: 'u1',
      channel: 'DISCORD_DM',
      notificationType: 'CYCLE_RESULTS',
      enabled: true,
    },
    {
      userId: 'u1',
      channel: 'DISCORD_DM',
      notificationType: 'CYCLE_PAYOUT_SENT',
      enabled: true,
    },
  ];

  const accounts = [
    { userId: 'u1', discordUserId: 'd1' },
    { userId: 'u2', discordUserId: 'd2' },
  ];

  function makePrisma(overrides?: Partial<any>) {
    return {
      cycle: {
        findUnique: jest.fn(async () => ({
          id: 'cycle_1',
          name: 'Cycle One',
          startedAt: new Date('2026-01-01T00:00:00.000Z'),
        })),
      },
      cycleParticipation: {
        findMany: jest.fn(async () => [{ userId: 'u1' }]),
        findUnique: jest.fn(async () => ({
          id: 'p1',
          userId: 'u1',
          characterName: 'MyChar',
          amountIsk: '100.00',
          payoutAmountIsk: '110.00',
          cycle: { id: 'cycle_1', name: 'Cycle One' },
        })),
      },
      notificationPreference: {
        findMany: jest.fn(async (args: any) => {
          const where = args?.where ?? {};
          const type = where.notificationType;
          const enabled = where.enabled;
          const allowedUsers: string[] | undefined = where?.userId?.in;
          return prefs.filter((p) => {
            if (enabled !== undefined && p.enabled !== enabled) return false;
            if (type && p.notificationType !== type) return false;
            if (allowedUsers && !allowedUsers.includes(p.userId)) return false;
            return true;
          });
        }),
      },
      discordAccount: {
        findMany: jest.fn(async (args: any) => {
          const allowedUsers: string[] | undefined = args?.where?.userId?.in;
          return accounts.filter(
            (a) => !allowedUsers || allowedUsers.includes(a.userId),
          );
        }),
        findFirst: jest.fn(async () => ({
          discordUserId: 'd1',
          username: 'test',
        })),
      },
      ...(overrides ?? {}),
    } as any;
  }

  function makeSvc(prisma: any) {
    const discordDm = {
      sendDirectMessage: jest.fn(async () => undefined),
    } as any;
    const characterManagement = {} as any;
    const svc = new NotificationService(prisma, discordDm, characterManagement);
    return { svc, discordDm };
  }

  it('notifyCyclePlanned sends a well-formatted DM to all opted-in users', async () => {
    const startedAt = new Date('2026-01-01T00:00:00.000Z');
    const prisma = makePrisma({
      cycle: {
        findUnique: jest.fn(async () => ({
          id: 'cycle_1',
          name: 'Cycle One',
          startedAt,
        })),
      },
    });
    const { svc, discordDm } = makeSvc(prisma);

    await svc.notifyCyclePlanned('cycle_1');

    expect(discordDm.sendDirectMessage).toHaveBeenCalledTimes(2);

    const calls = (discordDm.sendDirectMessage as jest.Mock).mock.calls;
    const message = String(calls[0][1]);

    expect(message).toContain(
      'A new investment cycle has been planned: **Cycle One**',
    );
    expect(message).toContain(`Planned start: ${startedAt.toISOString()}.`);
    expect(message).toContain('/tradecraft/cycles/opt-in');
    expect(message).toContain('/settings/notifications');

    const recipients = calls.map((c) => c[0]).sort();
    expect(recipients).toEqual(['d1', 'd2']);
  });

  it('notifyCycleStarted sends a DM to all opted-in users', async () => {
    const prisma = makePrisma();
    const { svc, discordDm } = makeSvc(prisma);

    await svc.notifyCycleStarted('cycle_1');

    expect(discordDm.sendDirectMessage).toHaveBeenCalledTimes(2);
    const calls = (discordDm.sendDirectMessage as jest.Mock).mock.calls;
    const message = String(calls[0][1]);
    expect(message).toContain('Cycle **Cycle One** has started.');
    expect(message).toContain('/tradecraft/cycle-details');
    expect(message).toContain('/settings/notifications');
  });

  it('notifyCycleResults sends a DM only to opted-in participants', async () => {
    const prisma = makePrisma({
      cycleParticipation: {
        findMany: jest.fn(async () => [{ userId: 'u1' }]),
      },
    });
    const { svc, discordDm } = makeSvc(prisma);

    await svc.notifyCycleResults('cycle_1');

    expect(discordDm.sendDirectMessage).toHaveBeenCalledTimes(1);
    const calls = (discordDm.sendDirectMessage as jest.Mock).mock.calls;
    expect(calls[0][0]).toBe('d1');
    const message = String(calls[0][1]);
    expect(message).toContain(
      'Results are now available for cycle **Cycle One**.',
    );
    expect(message).toContain('/tradecraft/cycle-details');
    expect(message).toContain('/settings/notifications');
  });

  it('notifyPayoutSent sends a DM to the participant when enabled', async () => {
    const prisma = makePrisma();
    const { svc, discordDm } = makeSvc(prisma);

    await svc.notifyPayoutSent('p1');

    expect(discordDm.sendDirectMessage).toHaveBeenCalledTimes(1);
    const calls = (discordDm.sendDirectMessage as jest.Mock).mock.calls;
    expect(calls[0][0]).toBe('d1');
    const message = String(calls[0][1]);
    expect(message).toContain(
      'Your payout for cycle **Cycle One** has been marked as sent.',
    );
    expect(message).toContain('Character: MyChar');
    expect(message).toContain('Investment: 100.00 ISK');
    expect(message).toContain('Payout: 110.00 ISK');
    expect(message).toContain('/settings/notifications');
  });
});
