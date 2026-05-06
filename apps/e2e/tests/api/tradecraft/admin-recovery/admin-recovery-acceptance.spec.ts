import { test, expect } from "@playwright/test";
import { createApiCall } from "../../../../testkit/api";
import { createPrisma } from "../../../../testkit/db";
import {
  seedTradecraftAcceptance,
  TRADECRAFT_ACCEPTANCE_SEED,
} from "../../../../testkit/tradecraft-acceptance-seed";

type UnmatchedDonationResponse = {
  journalId: string;
  amount: string;
  reason: string | null;
};

type CycleParticipationResponse = {
  id: string;
  cycleId: string;
  userId: string | null;
  amountIsk: string;
  refundAmountIsk: string | null;
  status: string;
  walletJournalId: string | null;
  payoutAmountIsk: string | null;
  payoutPaidAt: string | null;
};

type CycleLifecycleResponse = {
  settlementReport: {
    recoverableFailures: Array<{
      name: string;
      kind: string;
      status: string;
      message?: string;
    }>;
  };
};

type BackfillJingleYieldResponse = {
  targetCycleId: string;
  sourceClosedCycleId: string;
  ensured: { created: number; skippedExisting: number };
  rollovers: { processed: number; rolledOver: string; paidOut: string };
};

test.describe("Tradecraft Admin Recovery Flow acceptance", () => {
  test("allows admins to inspect unmatched donations, validate a pending payment, and mark a refund without changing cycle capital", async ({
    request,
  }) => {
    const prisma = createPrisma();
    try {
      const seeded = await seedTradecraftAcceptance(prisma);
      const api = createApiCall(request);

      const unmatchedBefore = await api<UnmatchedDonationResponse[]>(
        "GET",
        "/ledger/participations/unmatched-donations",
      );
      expect(unmatchedBefore).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            journalId: seeded.walletJournalIds.paymentMatchJournalId,
          }),
          expect.objectContaining({
            journalId: seeded.walletJournalIds.unmatchedJournalId,
            reason: "UNMATCHED-ACCEPTANCE-DONATION",
          }),
        ]),
      );

      const validated = await api<CycleParticipationResponse>(
        "POST",
        `/ledger/participations/${seeded.participations.paymentMatchParticipationId}/validate`,
        {
          walletJournal: {
            characterId: seeded.logisticsCharacterId,
            journalId: seeded.walletJournalIds.paymentMatchJournalId,
          },
        },
      );
      expect(validated).toEqual(
        expect.objectContaining({
          id: seeded.participations.paymentMatchParticipationId,
          status: "OPTED_IN",
          walletJournalId: seeded.walletJournalIds.paymentMatchJournalId,
        }),
      );

      const paymentLedger = await prisma.cycleLedgerEntry.findFirst({
        where: {
          participationId: seeded.participations.paymentMatchParticipationId,
          entryType: "deposit",
        },
        select: { cycleId: true, amount: true, memo: true },
      });
      expect(paymentLedger).toEqual(
        expect.objectContaining({
          cycleId: seeded.cycles.plannedCycleId,
          memo: expect.stringContaining("Participation deposit"),
        }),
      );
      expect(Number(paymentLedger?.amount ?? 0)).toBe(2_500_000_000);

      const openCycleBeforeRefund = await prisma.cycle.findUniqueOrThrow({
        where: { id: seeded.cycles.openCycleId },
        select: { initialCapitalIsk: true },
      });
      const refunded = await api<CycleParticipationResponse>(
        "POST",
        `/ledger/participations/${seeded.participations.normalOpenParticipationId}/refund`,
        { amountIsk: "3000000000.00" },
      );
      expect(refunded).toEqual(
        expect.objectContaining({
          id: seeded.participations.normalOpenParticipationId,
          status: "REFUNDED",
          refundAmountIsk: "3000000000",
        }),
      );

      const openCycleAfterRefund = await prisma.cycle.findUniqueOrThrow({
        where: { id: seeded.cycles.openCycleId },
        select: { initialCapitalIsk: true },
      });
      expect(Number(openCycleAfterRefund.initialCapitalIsk ?? 0)).toBe(
        Number(openCycleBeforeRefund.initialCapitalIsk ?? 0),
      );
    } finally {
      await prisma.$disconnect();
    }
  });

  test("surfaces recoverable Settlement Report failures for admin follow-up and supports payout follow-up marking", async ({
    request,
  }) => {
    const prisma = createPrisma();
    try {
      const seeded = await seedTradecraftAcceptance(prisma);
      const api = createApiCall(request);

      await prisma.cycleParticipation.create({
        data: {
          cycleId: seeded.cycles.plannedCycleId,
          userId: TRADECRAFT_ACCEPTANCE_SEED.users.refund.id,
          characterName: TRADECRAFT_ACCEPTANCE_SEED.users.refund.characterName,
          amountIsk: "500000000.00",
          userPrincipalIsk: "0.00",
          memo: `BROKEN-ROLLOVER-${seeded.cycles.plannedCycleId.substring(0, 8)}`,
          status: "AWAITING_INVESTMENT",
          rolloverType: "CUSTOM_AMOUNT",
          rolloverRequestedAmountIsk: "500000000.00",
          rolloverFromParticipationId:
            seeded.participations.refundParticipationId,
        },
      });

      const opened = await api<CycleLifecycleResponse>(
        "POST",
        `/ledger/cycles/${seeded.cycles.plannedCycleId}/open`,
        {},
      );

      expect(opened.settlementReport.recoverableFailures).toContainEqual(
        expect.objectContaining({
          name: "cycle_rollover",
          kind: "recoverable",
          status: "failed",
          message: expect.stringContaining("Missing authoritative payout"),
        }),
      );

      const customSource = await prisma.cycleParticipation.findUniqueOrThrow({
        where: { id: seeded.participations.customRolloverSourceParticipationId },
        select: { status: true, payoutAmountIsk: true, payoutPaidAt: true },
      });
      expect(customSource.status).toBe("AWAITING_PAYOUT");
      expect(customSource.payoutPaidAt).toBeNull();
      expect(Number(customSource.payoutAmountIsk ?? 0)).toBeGreaterThan(0);

      const markedPaid = await api<CycleParticipationResponse>(
        "POST",
        `/ledger/participations/${seeded.participations.customRolloverSourceParticipationId}/mark-payout-sent`,
        {},
      );
      expect(markedPaid).toEqual(
        expect.objectContaining({
          id: seeded.participations.customRolloverSourceParticipationId,
          status: "COMPLETED",
        }),
      );
      expect(markedPaid.payoutPaidAt).not.toBeNull();
    } finally {
      await prisma.$disconnect();
    }
  });

  test("backfills a missing JingleYield rollover through the supported admin API", async ({
    request,
  }) => {
    const prisma = createPrisma();
    try {
      const seeded = await seedTradecraftAcceptance(prisma);
      const api = createApiCall(request);
      const user = TRADECRAFT_ACCEPTANCE_SEED.users.refund;

      const sourceParticipation = await prisma.cycleParticipation.create({
        data: {
          cycleId: seeded.cycles.completedCycleId,
          userId: user.id,
          characterName: user.characterName,
          amountIsk: "2000000000.00",
          userPrincipalIsk: "0.00",
          memo: `JY-BACKFILL-SOURCE-${seeded.cycles.completedCycleId.substring(0, 8)}`,
          status: "COMPLETED",
          validatedAt: new Date("2026-01-03T00:00:00.000Z"),
          payoutAmountIsk: "2400000000.00",
        },
        select: { id: true },
      });
      const program = await prisma.jingleYieldProgram.create({
        data: {
          userId: user.id,
          adminCharacterId: seeded.logisticsCharacterId,
          rootParticipationId: sourceParticipation.id,
          status: "ACTIVE",
          lockedPrincipalIsk: "2000000000.00",
          cumulativeInterestIsk: "400000000.00",
          targetInterestIsk: "2000000000.00",
          startCycleId: seeded.cycles.completedCycleId,
          minCycles: 2,
        },
        select: { id: true },
      });
      await prisma.cycleParticipation.update({
        where: { id: sourceParticipation.id },
        data: { jingleYieldProgramId: program.id },
      });

      const backfilled = await api<BackfillJingleYieldResponse>(
        "POST",
        `/ledger/cycles/${seeded.cycles.plannedCycleId}/rollovers/backfill-jingle-yield`,
        { sourceClosedCycleId: seeded.cycles.completedCycleId },
      );
      expect(backfilled).toEqual(
        expect.objectContaining({
          targetCycleId: seeded.cycles.plannedCycleId,
          sourceClosedCycleId: seeded.cycles.completedCycleId,
          ensured: expect.objectContaining({ created: 1 }),
          rollovers: expect.objectContaining({ processed: 1 }),
        }),
      );

      const targetParticipation = await prisma.cycleParticipation.findFirst({
        where: {
          cycleId: seeded.cycles.plannedCycleId,
          userId: user.id,
          rolloverFromParticipationId: sourceParticipation.id,
        },
        select: {
          status: true,
          amountIsk: true,
          jingleYieldProgramId: true,
          validatedAt: true,
        },
      });
      expect(targetParticipation).toEqual(
        expect.objectContaining({
          status: "OPTED_IN",
          jingleYieldProgramId: program.id,
        }),
      );
      expect(targetParticipation?.validatedAt).not.toBeNull();
      expect(Number(targetParticipation?.amountIsk ?? 0)).toBeGreaterThan(0);
    } finally {
      await prisma.$disconnect();
    }
  });
});
