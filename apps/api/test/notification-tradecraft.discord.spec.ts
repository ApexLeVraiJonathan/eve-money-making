"use strict";

import axios from "axios";
import { PrismaClient } from "@eve/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { NotificationService } from "../src/notifications/notification.service";

// This test is meant to send REAL Discord DMs in a dev environment.
// It should run only when you explicitly invoke this file:
//   pnpm -C apps/api test -- --runInBand notification-tradecraft.discord.spec.ts
const isExplicitRun = process.argv.some((a) =>
  a.includes("notification-tradecraft.discord.spec.ts"),
);
const maybeDescribe = isExplicitRun ? describe : describe.skip;

const DEV_USER_ID = "22716c8e-d771-47c0-a1f0-ae1aef850bc6";

type Seeded = {
  cyclePlannedId: string;
  cycleOpenId: string;
  cycleCompletedId: string;
  participationId: string;
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(
      `Missing required env var ${name}. This test sends real DMs and needs it.`,
    );
  }
  return v;
}

async function sendDiscordDmStrict(params: {
  botToken: string;
  discordUserId: string;
  content: string;
}) {
  const apiBase = "https://discord.com/api";

  const channelRes = await axios.post<{ id: string }>(
    `${apiBase}/users/@me/channels`,
    { recipient_id: params.discordUserId },
    {
      headers: {
        Authorization: `Bot ${params.botToken}`,
        "Content-Type": "application/json",
      },
    },
  );
  const channelId = channelRes.data.id;
  if (!channelId) {
    throw new Error(`Failed to create DM channel for ${params.discordUserId}`);
  }

  await axios.post(
    `${apiBase}/channels/${channelId}/messages`,
    { content: params.content },
    {
      headers: {
        Authorization: `Bot ${params.botToken}`,
        "Content-Type": "application/json",
      },
    },
  );
}

async function seed(prisma: PrismaClient): Promise<Seeded> {
  // Ensure Discord account exists for this user (the app creates this when you connect).
  const account = await prisma.discordAccount.findFirst({
    where: { userId: DEV_USER_ID },
    select: { discordUserId: true },
  });
  if (!account?.discordUserId) {
    throw new Error(
      `No discordAccount row found for userId=${DEV_USER_ID}. Connect Discord first in /settings/notifications.`,
    );
  }

  // Create cycles used by each notification type.
  const planned = await prisma.cycle.create({
    data: {
      name: "DEV TEST (notifications) - Planned",
      status: "PLANNED",
      startedAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      initialCapitalIsk: "1000000000.00",
    },
    select: { id: true },
  });
  const open = await prisma.cycle.create({
    data: {
      name: "DEV TEST (notifications) - Open",
      status: "OPEN",
      startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      initialCapitalIsk: "1000000000.00",
    },
    select: { id: true },
  });
  const completed = await prisma.cycle.create({
    data: {
      name: "DEV TEST (notifications) - Completed",
      status: "COMPLETED",
      startedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      closedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      initialCapitalIsk: "1000000000.00",
    },
    select: { id: true },
  });

  // Participation for results + payout notifications.
  const participation = await prisma.cycleParticipation.create({
    data: {
      cycleId: completed.id,
      userId: DEV_USER_ID,
      characterName: "DEV TEST",
      amountIsk: "100.00",
      memo: `DEVTEST-${completed.id.substring(0, 8)}-${DEV_USER_ID.substring(
        0,
        8,
      )}`,
      status: "COMPLETED",
      validatedAt: new Date(),
      payoutAmountIsk: "110.00",
      payoutPaidAt: new Date(),
    },
    select: { id: true },
  });

  // Enable only Tradecraft notifications for this user (so we don't DM others).
  const types = [
    "CYCLE_PLANNED",
    "CYCLE_STARTED",
    "CYCLE_RESULTS",
    "CYCLE_PAYOUT_SENT",
  ] as const;
  for (const t of types) {
    await prisma.notificationPreference.upsert({
      where: {
        user_channel_type_unique: {
          userId: DEV_USER_ID,
          channel: "DISCORD_DM",
          notificationType: t,
        },
      },
      update: { enabled: true },
      create: {
        userId: DEV_USER_ID,
        channel: "DISCORD_DM",
        notificationType: t,
        enabled: true,
      },
    });
  }

  return {
    cyclePlannedId: planned.id,
    cycleOpenId: open.id,
    cycleCompletedId: completed.id,
    participationId: participation.id,
  };
}

async function cleanup(prisma: PrismaClient, seeded: Seeded | null) {
  if (!seeded) return;
  await prisma.cycleParticipation.deleteMany({
    where: { id: seeded.participationId },
  });
  await prisma.cycle.deleteMany({
    where: { id: { in: [seeded.cyclePlannedId, seeded.cycleOpenId, seeded.cycleCompletedId] } },
  });
}

maybeDescribe("Tradecraft notifications (manual Discord delivery)", () => {
  let prisma: PrismaClient;
  let seeded: Seeded | null = null;
  const sent: Array<{ kind: string; content: string }> = [];

  beforeAll(async () => {
    const dbUrl = requireEnv("DATABASE_URL");
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: dbUrl }),
    });
    seeded = await seed(prisma);
  });

  afterAll(async () => {
    await cleanup(prisma, seeded);
    await prisma.$disconnect();
  });

  it("sends the 4 Tradecraft DMs to the dev user", async () => {
    const botToken = requireEnv("DISCORD_BOT_TOKEN");

    const account = await prisma.discordAccount.findFirst({
      where: { userId: DEV_USER_ID },
      select: { discordUserId: true },
    });
    if (!account?.discordUserId) throw new Error("Discord not connected.");

    const discordDm = {
      sendDirectMessage: async (discordUserId: string, content: string) => {
        // Record content for local assertion and then send for real.
        sent.push({ kind: "dm", content });
        await sendDiscordDmStrict({ botToken, discordUserId, content });
      },
    } as any;

    const svc = new NotificationService(prisma as any, discordDm, {} as any);

    await svc.notifyCyclePlanned(seeded!.cyclePlannedId);
    await svc.notifyCycleStarted(seeded!.cycleOpenId);
    await svc.notifyCycleResults(seeded!.cycleCompletedId);
    await svc.notifyPayoutSent(seeded!.participationId);

    // Basic sanity assertions on formatting (you'll validate in Discord too).
    expect(sent.length).toBeGreaterThanOrEqual(4);
    const all = sent.map((s) => s.content).join("\n---\n");
    expect(all).toContain("/settings/notifications");
    expect(all).toContain("/tradecraft/cycle-details");
    expect(all).toContain("/tradecraft/cycles/opt-in");
  }, 60_000);
});


