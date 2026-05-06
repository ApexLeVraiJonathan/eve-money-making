import { test, expect } from "@playwright/test";
import { createApiCall } from "../../../../testkit/api";
import { createPrisma } from "../../../../testkit/db";
import {
  seedTradecraftAcceptance,
  TRADECRAFT_ACCEPTANCE_SEED,
} from "../../../../testkit/tradecraft-acceptance-seed";

type CycleParticipationResponse = {
  id: string;
  cycleId: string;
  userId: string | null;
  characterName: string;
  amountIsk: string;
  userPrincipalIsk: string | null;
  status: string;
  walletJournalId: string | null;
  rolloverType: string | null;
  rolloverRequestedAmountIsk: string | null;
  rolloverFromParticipationId: string | null;
};

type MatchParticipationPaymentsResponse = {
  matched: number;
  partial: number;
  unmatched: Array<{
    journalId: string;
    amount: string;
    reason: string | null;
  }>;
};

test.describe("Tradecraft Participation acceptance", () => {
  test("verifies Participation creation, caps, Payment Matching, and allocation boundaries from the canonical seed", async ({
    request,
  }) => {
    const prisma = createPrisma();
    try {
      const seeded = await seedTradecraftAcceptance(prisma);
      const api = createApiCall(request);

      const normal = TRADECRAFT_ACCEPTANCE_SEED.users.normal;
      const capUser = TRADECRAFT_ACCEPTANCE_SEED.users.paymentMatch;

      const created = await api<CycleParticipationResponse>(
        "POST",
        `/ledger/cycles/${seeded.cycles.plannedCycleId}/participations`,
        {
          testUserId: normal.id,
          characterName: normal.characterName,
          amountIsk: "1000000000.00",
        },
      );

      expect(created).toEqual(
        expect.objectContaining({
          cycleId: seeded.cycles.plannedCycleId,
          userId: normal.id,
          characterName: normal.characterName,
          amountIsk: "1000000000",
          userPrincipalIsk: "1000000000",
          status: "AWAITING_INVESTMENT",
          walletJournalId: null,
          rolloverType: null,
        }),
      );

      const plannedBeforeCapFailure = await prisma.cycle.findUniqueOrThrow({
        where: { id: seeded.cycles.openCycleId },
        select: { initialCapitalIsk: true },
      });

      await api("PATCH", `/admin/users/${capUser.id}/tradecraft-caps`, {
        principalCapIsk: "1000000000.00",
        maximumCapIsk: "1000000000.00",
      });

      const capFailure = await request.fetch(
        `${process.env.API_URL ?? "http://localhost:3000"}/ledger/cycles/${seeded.cycles.openCycleId}/participations/admin`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.E2E_API_KEY ?? "",
          },
          data: {
            primaryCharacterId: capUser.characterId,
            amountIsk: "2000000000.00",
          },
        },
      );
      expect(capFailure.ok()).toBe(false);
      expect(capFailure.status()).toBe(400);
      expect(await capFailure.text()).toContain("exceeds");

      const plannedAfterCapFailure = await prisma.cycle.findUniqueOrThrow({
        where: { id: seeded.cycles.openCycleId },
        select: { initialCapitalIsk: true },
      });
      expect(Number(plannedAfterCapFailure.initialCapitalIsk ?? 0)).toBe(
        Number(plannedBeforeCapFailure.initialCapitalIsk ?? 0),
      );

      await Promise.all([
        api("PATCH", `/admin/users/${TRADECRAFT_ACCEPTANCE_SEED.users.fullPayout.id}/tradecraft-caps`, {
          principalCapIsk: "20000000000.00",
          maximumCapIsk: "20000000000.00",
        }),
        api("PATCH", `/admin/users/${TRADECRAFT_ACCEPTANCE_SEED.users.customRollover.id}/tradecraft-caps`, {
          principalCapIsk: "20000000000.00",
          maximumCapIsk: "20000000000.00",
        }),
      ]);

      const pendingBeforeAllocation =
        await prisma.cycleParticipation.findUniqueOrThrow({
          where: { id: seeded.participations.paymentMatchParticipationId },
          select: { status: true, walletJournalId: true },
        });
      expect(pendingBeforeAllocation).toEqual({
        status: "AWAITING_INVESTMENT",
        walletJournalId: null,
      });

      await api("POST", `/ledger/cycles/${seeded.cycles.openCycleId}/allocate`, {});

      const pendingAfterAllocation =
        await prisma.cycleParticipation.findUniqueOrThrow({
          where: { id: seeded.participations.paymentMatchParticipationId },
          select: { status: true, walletJournalId: true },
        });
      expect(pendingAfterAllocation).toEqual({
        status: "AWAITING_INVESTMENT",
        walletJournalId: null,
      });

      const matchResult = await api<MatchParticipationPaymentsResponse>(
        "POST",
        `/ledger/participations/match?cycleId=${seeded.cycles.plannedCycleId}`,
        {},
      );
      expect(matchResult.matched).toBe(1);
      expect(matchResult.partial).toBe(0);
      expect(matchResult.unmatched).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            journalId: seeded.walletJournalIds.unmatchedJournalId,
            reason: "UNMATCHED-ACCEPTANCE-DONATION",
          }),
        ]),
      );

      const matchedParticipation =
        await prisma.cycleParticipation.findUniqueOrThrow({
          where: { id: seeded.participations.paymentMatchParticipationId },
          select: {
            status: true,
            walletJournalId: true,
            amountIsk: true,
            characterName: true,
          },
        });
      expect(matchedParticipation.status).toBe("OPTED_IN");
      expect(matchedParticipation.walletJournalId).toBe(
        BigInt(seeded.walletJournalIds.paymentMatchJournalId),
      );
      expect(Number(matchedParticipation.amountIsk)).toBe(2_500_000_000);
      expect(matchedParticipation.characterName).toBe(
        TRADECRAFT_ACCEPTANCE_SEED.users.paymentMatch.characterName,
      );

      const plannedParticipations = await api<CycleParticipationResponse[]>(
        "GET",
        `/ledger/cycles/${seeded.cycles.plannedCycleId}/participations`,
      );
      expect(plannedParticipations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: seeded.participations.paymentMatchParticipationId,
            status: "OPTED_IN",
            walletJournalId: seeded.walletJournalIds.paymentMatchJournalId,
          }),
          expect.objectContaining({
            id: seeded.participations.fullPayoutTargetParticipationId,
            rolloverType: "FULL_PAYOUT",
            rolloverFromParticipationId:
              seeded.participations.fullPayoutSourceParticipationId,
          }),
          expect.objectContaining({
            id: seeded.participations.customRolloverTargetParticipationId,
            rolloverType: "CUSTOM_AMOUNT",
            rolloverRequestedAmountIsk: "1500000000",
            rolloverFromParticipationId:
              seeded.participations.customRolloverSourceParticipationId,
          }),
        ]),
      );

      await api(
        "POST",
        `/ledger/cycles/${seeded.cycles.plannedCycleId}/open`,
        {},
      );

      const [
        fullPayoutSource,
        fullPayoutTarget,
        customRolloverSource,
        customRolloverTarget,
      ] = await Promise.all([
        prisma.cycleParticipation.findUniqueOrThrow({
          where: { id: seeded.participations.fullPayoutSourceParticipationId },
          select: {
            status: true,
            payoutAmountIsk: true,
            rolloverDeductedIsk: true,
            payoutPaidAt: true,
          },
        }),
        prisma.cycleParticipation.findUniqueOrThrow({
          where: { id: seeded.participations.fullPayoutTargetParticipationId },
          select: { status: true, amountIsk: true, validatedAt: true },
        }),
        prisma.cycleParticipation.findUniqueOrThrow({
          where: { id: seeded.participations.customRolloverSourceParticipationId },
          select: {
            status: true,
            payoutAmountIsk: true,
            rolloverDeductedIsk: true,
            payoutPaidAt: true,
          },
        }),
        prisma.cycleParticipation.findUniqueOrThrow({
          where: { id: seeded.participations.customRolloverTargetParticipationId },
          select: { status: true, amountIsk: true, validatedAt: true },
        }),
      ]);

      const fullPayoutRemainder = Number(fullPayoutSource.payoutAmountIsk ?? 0);
      expect(fullPayoutRemainder).toBeGreaterThanOrEqual(0);
      expect(Number(fullPayoutTarget.amountIsk)).toBe(
        Number(fullPayoutSource.rolloverDeductedIsk),
      );
      expect(Number(fullPayoutTarget.amountIsk)).toBeGreaterThanOrEqual(
        2_000_000_000,
      );
      if (fullPayoutRemainder > 0) {
        expect(fullPayoutSource.status).toBe("AWAITING_PAYOUT");
        expect(fullPayoutSource.payoutPaidAt).toBeNull();
      } else {
        expect(fullPayoutSource.status).toBe("COMPLETED");
        expect(fullPayoutSource.payoutPaidAt).not.toBeNull();
      }
      expect(fullPayoutTarget.status).toBe("OPTED_IN");
      expect(fullPayoutTarget.validatedAt).not.toBeNull();

      expect(customRolloverSource.status).toBe("AWAITING_PAYOUT");
      expect(Number(customRolloverSource.rolloverDeductedIsk)).toBe(
        1_500_000_000,
      );
      expect(Number(customRolloverSource.payoutAmountIsk ?? 0)).toBeGreaterThan(
        0,
      );
      expect(customRolloverSource.payoutPaidAt).toBeNull();
      expect(Number(customRolloverTarget.amountIsk)).toBe(1_500_000_000);
      expect(customRolloverTarget.status).toBe("OPTED_IN");
      expect(customRolloverTarget.validatedAt).not.toBeNull();
    } finally {
      await prisma.$disconnect();
    }
  });
});
