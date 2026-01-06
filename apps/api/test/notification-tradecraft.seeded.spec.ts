import { PrismaClient } from '@eve/prisma';
import { NotificationService } from '../src/notifications/notification.service';

type SeedOut = {
  users: { u1: string; u2: string };
  cycles: { planned: string; open: string; completed: string };
  participations: { payout: string };
};

function uuid(id: string) {
  // Convenience: allow short labels but keep valid UUIDs for schema defaults.
  // (Prisma allows explicit ids; using UUIDs avoids surprises.)
  return id;
}

async function seedTradecraftNotificationFixtures(
  prisma: PrismaClient,
): Promise<SeedOut> {
  const u1 = uuid('22716c8e-d771-47c0-a1f0-ae1aef850bc6');
  const u2 = uuid('11111111-1111-1111-1111-111111111111');

  // Clean any previous runs for the same IDs (idempotent).
  await prisma.notificationPreference.deleteMany({ where: { userId: { in: [u1, u2] } } });
  await prisma.discordAccount.deleteMany({ where: { userId: { in: [u1, u2] } } });
  await prisma.user.deleteMany({ where: { id: { in: [u1, u2] } } });

  await prisma.user.createMany({
    data: [
      { id: u1, role: 'USER' },
      { id: u2, role: 'USER' },
    ],
    skipDuplicates: true,
  });

  await prisma.discordAccount.createMany({
    data: [
      {
        userId: u1,
        discordUserId: 'discord_u1',
        username: 'TestU1',
        discriminator: null,
        avatarUrl: null,
      },
      {
        userId: u2,
        discordUserId: 'discord_u2',
        username: 'TestU2',
        discriminator: null,
        avatarUrl: null,
      },
    ],
  });

  // Create three cycles for different lifecycle notifications.
  const planned = await prisma.cycle.create({
    data: {
      name: 'Seeded Planned Cycle',
      status: 'PLANNED',
      startedAt: new Date('2026-01-10T00:00:00.000Z'),
      initialCapitalIsk: '1000000000.00',
    },
    select: { id: true },
  });

  const open = await prisma.cycle.create({
    data: {
      name: 'Seeded Open Cycle',
      status: 'OPEN',
      startedAt: new Date('2026-01-05T00:00:00.000Z'),
      initialCapitalIsk: '1000000000.00',
    },
    select: { id: true },
  });

  const completed = await prisma.cycle.create({
    data: {
      name: 'Seeded Completed Cycle',
      status: 'COMPLETED',
      startedAt: new Date('2025-12-01T00:00:00.000Z'),
      closedAt: new Date('2025-12-20T00:00:00.000Z'),
      initialCapitalIsk: '1000000000.00',
    },
    select: { id: true },
  });

  // Participant rows used for "results" and "payout".
  const resultsParticipation = await prisma.cycleParticipation.create({
    data: {
      cycleId: completed.id,
      userId: u1,
      characterName: 'Seeded Character',
      amountIsk: '100.00',
      memo: `SEED-${completed.id.substring(0, 8)}-${u1.substring(0, 8)}`,
      status: 'COMPLETED',
      validatedAt: new Date(),
      payoutAmountIsk: '110.00',
      payoutPaidAt: new Date(),
    },
    select: { id: true },
  });

  // Preferences:
  // - Planned/Started for both users
  // - Results/Payout only for u1 (participant)
  await prisma.notificationPreference.createMany({
    data: [
      { userId: u1, channel: 'DISCORD_DM', notificationType: 'CYCLE_PLANNED', enabled: true },
      { userId: u2, channel: 'DISCORD_DM', notificationType: 'CYCLE_PLANNED', enabled: true },
      { userId: u1, channel: 'DISCORD_DM', notificationType: 'CYCLE_STARTED', enabled: true },
      { userId: u2, channel: 'DISCORD_DM', notificationType: 'CYCLE_STARTED', enabled: true },
      { userId: u1, channel: 'DISCORD_DM', notificationType: 'CYCLE_RESULTS', enabled: true },
      { userId: u1, channel: 'DISCORD_DM', notificationType: 'CYCLE_PAYOUT_SENT', enabled: true },
    ],
  });

  return {
    users: { u1, u2 },
    cycles: { planned: planned.id, open: open.id, completed: completed.id },
    participations: { payout: resultsParticipation.id },
  };
}

async function cleanup(prisma: PrismaClient, seeded: SeedOut) {
  const { u1, u2 } = seeded.users;
  await prisma.notificationPreference.deleteMany({ where: { userId: { in: [u1, u2] } } });
  await prisma.discordAccount.deleteMany({ where: { userId: { in: [u1, u2] } } });
  await prisma.cycleParticipation.deleteMany({ where: { userId: { in: [u1, u2] } } });
  await prisma.cycle.deleteMany({ where: { id: { in: [seeded.cycles.planned, seeded.cycles.open, seeded.cycles.completed] } } });
  await prisma.user.deleteMany({ where: { id: { in: [u1, u2] } } });
}

describe('Tradecraft notifications (seeded DB)', () => {
  const hasDb = Boolean(process.env.DATABASE_URL);
  const maybeDescribe = hasDb ? describe : describe.skip;

  maybeDescribe('integration', () => {
    let prisma: PrismaClient;
    let seeded: SeedOut;

    beforeAll(async () => {
      prisma = new PrismaClient();
      seeded = await seedTradecraftNotificationFixtures(prisma);
    });

    afterAll(async () => {
      await cleanup(prisma, seeded);
      await prisma.$disconnect();
    });

    it('notifyCyclePlanned sends to all opted-in users', async () => {
      const discordDm = { sendDirectMessage: jest.fn(async () => undefined) } as any;
      const svc = new NotificationService(prisma as any, discordDm, {} as any);
      await svc.notifyCyclePlanned(seeded.cycles.planned);

      const recipients = (discordDm.sendDirectMessage as jest.Mock).mock.calls
        .map((c) => c[0])
        .sort();
      expect(recipients).toEqual(['discord_u1', 'discord_u2']);
    });

    it('notifyCycleStarted sends to all opted-in users', async () => {
      const discordDm = { sendDirectMessage: jest.fn(async () => undefined) } as any;
      const svc = new NotificationService(prisma as any, discordDm, {} as any);
      await svc.notifyCycleStarted(seeded.cycles.open);

      const recipients = (discordDm.sendDirectMessage as jest.Mock).mock.calls
        .map((c) => c[0])
        .sort();
      expect(recipients).toEqual(['discord_u1', 'discord_u2']);
    });

    it('notifyCycleResults sends only to opted-in participants', async () => {
      const discordDm = { sendDirectMessage: jest.fn(async () => undefined) } as any;
      const svc = new NotificationService(prisma as any, discordDm, {} as any);
      await svc.notifyCycleResults(seeded.cycles.completed);

      const recipients = (discordDm.sendDirectMessage as jest.Mock).mock.calls.map((c) => c[0]);
      expect(recipients).toEqual(['discord_u1']);
    });

    it('notifyPayoutSent sends only to the participant when enabled', async () => {
      const discordDm = { sendDirectMessage: jest.fn(async () => undefined) } as any;
      const svc = new NotificationService(prisma as any, discordDm, {} as any);
      await svc.notifyPayoutSent(seeded.participations.payout);

      const recipients = (discordDm.sendDirectMessage as jest.Mock).mock.calls.map((c) => c[0]);
      expect(recipients).toEqual(['discord_u1']);
    });
  });
});


