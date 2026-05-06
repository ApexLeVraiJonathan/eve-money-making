import { test, expect } from "@playwright/test";
import { createPrisma } from "../../../../testkit/db";
import {
  seedTradecraftAcceptance,
  TRADECRAFT_ACCEPTANCE_SEED,
} from "../../../../testkit/tradecraft-acceptance-seed";

test.describe("Tradecraft acceptance seed", () => {
  test("creates the canonical dataset for pre-main acceptance testing", async () => {
    const prisma = createPrisma();
    try {
      const seeded = await seedTradecraftAcceptance(prisma);

      const cycles = await prisma.cycle.findMany({
        where: {
          name: { in: Object.values(TRADECRAFT_ACCEPTANCE_SEED.cycles) },
        },
        select: { id: true, name: true, status: true },
        orderBy: { name: "asc" },
      });

      expect(cycles).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: seeded.cycles.completedCycleId,
            name: TRADECRAFT_ACCEPTANCE_SEED.cycles.completed,
            status: "COMPLETED",
          }),
          expect.objectContaining({
            id: seeded.cycles.openCycleId,
            name: TRADECRAFT_ACCEPTANCE_SEED.cycles.open,
            status: "OPEN",
          }),
          expect.objectContaining({
            id: seeded.cycles.plannedCycleId,
            name: TRADECRAFT_ACCEPTANCE_SEED.cycles.planned,
            status: "PLANNED",
          }),
        ]),
      );

      const participations = await prisma.cycleParticipation.findMany({
        where: {
          id: {
            in: Object.values(seeded.participations),
          },
        },
        select: {
          id: true,
          cycleId: true,
          status: true,
          rolloverType: true,
          rolloverRequestedAmountIsk: true,
          rolloverFromParticipationId: true,
          walletJournalId: true,
          jingleYieldProgramId: true,
          refundAmountIsk: true,
        },
      });
      expect(participations).toHaveLength(8);
      expect(participations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: seeded.participations.normalOpenParticipationId,
            cycleId: seeded.cycles.openCycleId,
            status: "OPTED_IN",
          }),
          expect.objectContaining({
            id: seeded.participations.paymentMatchParticipationId,
            cycleId: seeded.cycles.plannedCycleId,
            status: "AWAITING_INVESTMENT",
            walletJournalId: null,
          }),
          expect.objectContaining({
            id: seeded.participations.fullPayoutTargetParticipationId,
            cycleId: seeded.cycles.plannedCycleId,
            rolloverType: "FULL_PAYOUT",
            rolloverFromParticipationId:
              seeded.participations.fullPayoutSourceParticipationId,
          }),
          expect.objectContaining({
            id: seeded.participations.customRolloverTargetParticipationId,
            cycleId: seeded.cycles.plannedCycleId,
            rolloverType: "CUSTOM_AMOUNT",
            rolloverFromParticipationId:
              seeded.participations.customRolloverSourceParticipationId,
          }),
          expect.objectContaining({
            id: seeded.participations.jingleYieldRootParticipationId,
            jingleYieldProgramId: seeded.jingleYieldProgramId,
          }),
          expect.objectContaining({
            id: seeded.participations.refundParticipationId,
            status: "REFUNDED",
          }),
        ]),
      );

      const jingleYieldProgram = await prisma.jingleYieldProgram.findUnique({
        where: { id: seeded.jingleYieldProgramId },
        select: {
          status: true,
          rootParticipationId: true,
          lockedPrincipalIsk: true,
          minCycles: true,
        },
      });
      expect(jingleYieldProgram).toEqual(
        expect.objectContaining({
          status: "ACTIVE",
          rootParticipationId:
            seeded.participations.jingleYieldRootParticipationId,
          minCycles: 2,
        }),
      );
      expect(Number(jingleYieldProgram?.lockedPrincipalIsk ?? 0)).toBe(
        2_000_000_000,
      );

      const [paymentMatchJournal, unmatchedJournal] =
        await prisma.walletJournalEntry.findMany({
          where: {
            journalId: {
              in: [
                BigInt(seeded.walletJournalIds.paymentMatchJournalId),
                BigInt(seeded.walletJournalIds.unmatchedJournalId),
              ],
            },
          },
          select: { journalId: true, refType: true, reason: true },
          orderBy: { journalId: "asc" },
        });
      expect(paymentMatchJournal).toEqual(
        expect.objectContaining({
          journalId: BigInt(seeded.walletJournalIds.paymentMatchJournalId),
          refType: "player_donation",
        }),
      );
      expect(paymentMatchJournal.reason).toContain("ACCEPT-PAY");
      expect(unmatchedJournal).toEqual(
        expect.objectContaining({
          journalId: BigInt(seeded.walletJournalIds.unmatchedJournalId),
          reason: "UNMATCHED-ACCEPTANCE-DONATION",
        }),
      );

      await expect(
        prisma.cycleLine.findUnique({ where: { id: seeded.cycleLineId } }),
      ).resolves.toEqual(
        expect.objectContaining({
          cycleId: seeded.cycles.openCycleId,
          unitsBought: 100,
          unitsSold: 60,
        }),
      );
    } finally {
      await prisma.$disconnect();
    }
  });
});
