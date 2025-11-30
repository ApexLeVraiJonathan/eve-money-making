import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@api/prisma/prisma.service';
import { NotificationService } from '../src/notifications/notification.service';
import { DiscordDmService } from '../src/notifications/discord-dm.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let prisma: PrismaService;
  let discordDm: DiscordDmService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: PrismaService,
          useValue: {
            cycle: { findUnique: jest.fn() },
            cycleParticipation: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
            },
            notificationPreference: { findMany: jest.fn() },
            discordAccount: { findMany: jest.fn() },
          },
        },
        {
          provide: DiscordDmService,
          useValue: {
            sendDirectMessage: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(NotificationService);
    prisma = module.get(PrismaService);
    discordDm = module.get(DiscordDmService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('notifyCyclePlanned should skip when no subscribers', async () => {
    (prisma.cycle.findUnique as jest.Mock).mockResolvedValue({
      id: 'cycle1',
      name: 'Test Cycle',
      startedAt: new Date(),
    });
    (prisma.notificationPreference.findMany as jest.Mock).mockResolvedValue([]);

    await service.notifyCyclePlanned('cycle1');

    expect(discordDm.sendDirectMessage).not.toHaveBeenCalled();
  });

  it('notifyPayoutSent should DM when user and preference exist', async () => {
    (prisma.cycleParticipation.findUnique as jest.Mock).mockResolvedValue({
      id: 'part1',
      userId: 'user1',
      characterName: 'Tester',
      amountIsk: '100000000.00',
      payoutAmountIsk: '150000000.00',
      cycle: { id: 'cycle1', name: 'Test Cycle' },
    });
    (prisma.notificationPreference.findMany as jest.Mock).mockResolvedValue([
      {
        userId: 'user1',
        channel: 'DISCORD_DM',
        notificationType: 'CYCLE_PAYOUT_SENT',
        enabled: true,
      },
    ]);
    (prisma.discordAccount.findMany as jest.Mock).mockResolvedValue([
      { userId: 'user1', discordUserId: 'discordUser123' },
    ]);

    await service.notifyPayoutSent('part1');

    expect(discordDm.sendDirectMessage).toHaveBeenCalledWith(
      'discordUser123',
      expect.stringContaining('payout for cycle'),
    );
  });
});
