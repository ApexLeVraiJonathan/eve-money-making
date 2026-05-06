import {
  CharacterManagedBy,
  CharacterRole,
  type PrismaClient,
} from "@eve/prisma";
import { ensureE2eAdmin, resetTradecraftData } from "./db";

const BASE_DATE = new Date("2026-05-05T12:00:00.000Z");

export const TRADECRAFT_ACCEPTANCE_SEED = {
  cycles: {
    completed: "Acceptance Completed Cycle",
    open: "Acceptance Open Cycle",
    planned: "Acceptance Planned Cycle",
  },
  users: {
    normal: {
      id: "acceptance-user-normal",
      characterId: 99101001,
      characterName: "Acceptance Normal Investor",
    },
    paymentMatch: {
      id: "acceptance-user-payment-match",
      characterId: 99101002,
      characterName: "Acceptance Payment Match Investor",
    },
    fullPayout: {
      id: "acceptance-user-full-payout",
      characterId: 99101003,
      characterName: "Acceptance Full Payout Investor",
    },
    customRollover: {
      id: "acceptance-user-custom-rollover",
      characterId: 99101004,
      characterName: "Acceptance Custom Rollover Investor",
    },
    jingleYield: {
      id: "acceptance-user-jingle-yield",
      characterId: 99101005,
      characterName: "Acceptance JingleYield Investor",
    },
    refund: {
      id: "acceptance-user-refund",
      characterId: 99101006,
      characterName: "Acceptance Refund Investor",
    },
  },
  logistics: {
    characterId: 99101999,
    characterName: "Acceptance Logistics",
  },
  market: {
    typeId: 34,
    destinationStationId: 60003760,
  },
} as const;

export type TradecraftAcceptanceSeedResult = {
  adminUserId: string;
  logisticsCharacterId: number;
  cycles: {
    completedCycleId: string;
    openCycleId: string;
    plannedCycleId: string;
  };
  participations: {
    normalOpenParticipationId: string;
    paymentMatchParticipationId: string;
    fullPayoutSourceParticipationId: string;
    fullPayoutTargetParticipationId: string;
    customRolloverSourceParticipationId: string;
    customRolloverTargetParticipationId: string;
    jingleYieldRootParticipationId: string;
    refundParticipationId: string;
  };
  jingleYieldProgramId: string;
  cycleLineId: string;
  walletJournalIds: {
    paymentMatchJournalId: string;
    unmatchedJournalId: string;
  };
};

function daysFromBase(days: number) {
  return new Date(BASE_DATE.getTime() + days * 24 * 60 * 60 * 1000);
}

async function ensureSeedUser(
  prisma: PrismaClient,
  input: {
    id: string;
    characterId: number;
    characterName: string;
  },
) {
  await prisma.user.upsert({
    where: { id: input.id },
    update: {
      role: "USER",
      enabledFeatures: ["TRADECRAFT"],
      tradecraftPrincipalCapIsk: null,
      tradecraftMaximumCapIsk: null,
    },
    create: {
      id: input.id,
      role: "USER",
      enabledFeatures: ["TRADECRAFT"],
    },
  });

  await prisma.eveCharacter.upsert({
    where: { id: input.characterId },
    update: {
      name: input.characterName,
      ownerHash: `acceptance-owner-${input.id}`,
      userId: input.id,
      role: CharacterRole.USER,
      managedBy: CharacterManagedBy.USER,
    },
    create: {
      id: input.characterId,
      name: input.characterName,
      ownerHash: `acceptance-owner-${input.id}`,
      userId: input.id,
      role: CharacterRole.USER,
      managedBy: CharacterManagedBy.USER,
    },
  });

  await prisma.user.update({
    where: { id: input.id },
    data: { primaryCharacterId: input.characterId },
  });
}

async function ensureAcceptanceUsers(prisma: PrismaClient) {
  await Promise.all(
    Object.values(TRADECRAFT_ACCEPTANCE_SEED.users).map((user) =>
      ensureSeedUser(prisma, user),
    ),
  );

  await prisma.eveCharacter.upsert({
    where: { id: TRADECRAFT_ACCEPTANCE_SEED.logistics.characterId },
    update: {
      name: TRADECRAFT_ACCEPTANCE_SEED.logistics.characterName,
      ownerHash: "acceptance-owner-logistics",
      role: CharacterRole.LOGISTICS,
      managedBy: CharacterManagedBy.SYSTEM,
      userId: null,
    },
    create: {
      id: TRADECRAFT_ACCEPTANCE_SEED.logistics.characterId,
      name: TRADECRAFT_ACCEPTANCE_SEED.logistics.characterName,
      ownerHash: "acceptance-owner-logistics",
      role: CharacterRole.LOGISTICS,
      managedBy: CharacterManagedBy.SYSTEM,
      userId: null,
    },
  });
}

export async function seedTradecraftAcceptance(
  prisma: PrismaClient,
): Promise<TradecraftAcceptanceSeedResult> {
  const adminUserId = await ensureE2eAdmin(prisma);
  await resetTradecraftData(prisma);
  await ensureAcceptanceUsers(prisma);

  const [completedCycle, openCycle, plannedCycle] = await Promise.all([
    prisma.cycle.create({
      data: {
        name: TRADECRAFT_ACCEPTANCE_SEED.cycles.completed,
        status: "COMPLETED",
        startedAt: daysFromBase(-28),
        closedAt: daysFromBase(-14),
        initialCapitalIsk: "8000000000.00",
      },
      select: { id: true },
    }),
    prisma.cycle.create({
      data: {
        name: TRADECRAFT_ACCEPTANCE_SEED.cycles.open,
        status: "OPEN",
        startedAt: daysFromBase(-7),
        initialCapitalIsk: "11000000000.00",
      },
      select: { id: true },
    }),
    prisma.cycle.create({
      data: {
        name: TRADECRAFT_ACCEPTANCE_SEED.cycles.planned,
        status: "PLANNED",
        startedAt: daysFromBase(7),
        initialInjectionIsk: "1000000000.00",
      },
      select: { id: true },
    }),
  ]);

  const normal = TRADECRAFT_ACCEPTANCE_SEED.users.normal;
  const paymentMatch = TRADECRAFT_ACCEPTANCE_SEED.users.paymentMatch;
  const fullPayout = TRADECRAFT_ACCEPTANCE_SEED.users.fullPayout;
  const customRollover = TRADECRAFT_ACCEPTANCE_SEED.users.customRollover;
  const jingleYield = TRADECRAFT_ACCEPTANCE_SEED.users.jingleYield;
  const refund = TRADECRAFT_ACCEPTANCE_SEED.users.refund;

  const [
    normalOpenParticipation,
    paymentMatchParticipation,
    fullPayoutSourceParticipation,
    customRolloverSourceParticipation,
    refundParticipation,
  ] = await Promise.all([
    prisma.cycleParticipation.create({
      data: {
        cycleId: openCycle.id,
        userId: normal.id,
        characterName: normal.characterName,
        amountIsk: "3000000000.00",
        userPrincipalIsk: "3000000000.00",
        memo: `ACCEPT-${openCycle.id.substring(0, 8)}-${normal.id}`,
        status: "OPTED_IN",
        validatedAt: daysFromBase(-6),
      },
      select: { id: true },
    }),
    prisma.cycleParticipation.create({
      data: {
        cycleId: plannedCycle.id,
        userId: paymentMatch.id,
        characterName: paymentMatch.characterName,
        amountIsk: "2500000000.00",
        userPrincipalIsk: "2500000000.00",
        memo: `ACCEPT-PAY-${plannedCycle.id.substring(0, 8)}`,
        status: "AWAITING_INVESTMENT",
      },
      select: { id: true, memo: true },
    }),
    prisma.cycleParticipation.create({
      data: {
        cycleId: openCycle.id,
        userId: fullPayout.id,
        characterName: fullPayout.characterName,
        amountIsk: "2000000000.00",
        userPrincipalIsk: "2000000000.00",
        memo: `ACCEPT-SOURCE-${openCycle.id.substring(0, 8)}-${fullPayout.id}`,
        status: "OPTED_IN",
        validatedAt: daysFromBase(-6),
      },
      select: { id: true },
    }),
    prisma.cycleParticipation.create({
      data: {
        cycleId: openCycle.id,
        userId: customRollover.id,
        characterName: customRollover.characterName,
        amountIsk: "4000000000.00",
        userPrincipalIsk: "4000000000.00",
        memo: `ACCEPT-SOURCE-${openCycle.id.substring(0, 8)}-${customRollover.id}`,
        status: "OPTED_IN",
        validatedAt: daysFromBase(-6),
      },
      select: { id: true },
    }),
    prisma.cycleParticipation.create({
      data: {
        cycleId: openCycle.id,
        userId: refund.id,
        characterName: refund.characterName,
        amountIsk: "1000000000.00",
        userPrincipalIsk: "1000000000.00",
        memo: `ACCEPT-REFUND-${openCycle.id.substring(0, 8)}`,
        status: "REFUNDED",
        refundAmountIsk: "1000000000.00",
        refundedAt: daysFromBase(-5),
      },
      select: { id: true },
    }),
  ]);

  const [fullPayoutTargetParticipation, customRolloverTargetParticipation] =
    await Promise.all([
      prisma.cycleParticipation.create({
        data: {
          cycleId: plannedCycle.id,
          userId: fullPayout.id,
          characterName: fullPayout.characterName,
          amountIsk: "1.00",
          userPrincipalIsk: "0.00",
          memo: `ROLLOVER-FULL-${plannedCycle.id.substring(0, 8)}`,
          status: "AWAITING_INVESTMENT",
          rolloverType: "FULL_PAYOUT",
          rolloverFromParticipationId: fullPayoutSourceParticipation.id,
        },
        select: { id: true },
      }),
      prisma.cycleParticipation.create({
        data: {
          cycleId: plannedCycle.id,
          userId: customRollover.id,
          characterName: customRollover.characterName,
          amountIsk: "1500000000.00",
          userPrincipalIsk: "0.00",
          memo: `ROLLOVER-CUSTOM-${plannedCycle.id.substring(0, 8)}`,
          status: "AWAITING_INVESTMENT",
          rolloverType: "CUSTOM_AMOUNT",
          rolloverRequestedAmountIsk: "1500000000.00",
          rolloverFromParticipationId: customRolloverSourceParticipation.id,
        },
        select: { id: true },
      }),
    ]);

  const jingleYieldRootParticipation = await prisma.cycleParticipation.create({
    data: {
      cycleId: openCycle.id,
      userId: jingleYield.id,
      characterName: jingleYield.characterName,
      amountIsk: "2000000000.00",
      userPrincipalIsk: "0.00",
      memo: `JY-ROOT-${openCycle.id.substring(0, 8)}`,
      status: "OPTED_IN",
      validatedAt: daysFromBase(-6),
      rolloverType: "INITIAL_ONLY",
    },
    select: { id: true },
  });

  const jingleYieldProgram = await prisma.jingleYieldProgram.create({
    data: {
      userId: jingleYield.id,
      adminCharacterId: TRADECRAFT_ACCEPTANCE_SEED.logistics.characterId,
      rootParticipationId: jingleYieldRootParticipation.id,
      status: "ACTIVE",
      lockedPrincipalIsk: "2000000000.00",
      cumulativeInterestIsk: "500000000.00",
      targetInterestIsk: "2000000000.00",
      startCycleId: openCycle.id,
      minCycles: 2,
    },
    select: { id: true },
  });

  await prisma.cycleParticipation.update({
    where: { id: jingleYieldRootParticipation.id },
    data: { jingleYieldProgramId: jingleYieldProgram.id },
  });

  const cycleLine = await prisma.cycleLine.create({
    data: {
      cycleId: openCycle.id,
      typeId: TRADECRAFT_ACCEPTANCE_SEED.market.typeId,
      destinationStationId: TRADECRAFT_ACCEPTANCE_SEED.market.destinationStationId,
      plannedUnits: 100,
      unitsBought: 100,
      buyCostIsk: "1000000000.00",
      unitsSold: 60,
      salesGrossIsk: "900000000.00",
      salesTaxIsk: "45000000.00",
      salesNetIsk: "855000000.00",
      brokerFeesIsk: "20000000.00",
      relistFeesIsk: "5000000.00",
      currentSellPriceIsk: "16000000.00",
      listedUnits: 40,
    },
    select: { id: true },
  });

  await Promise.all([
    prisma.cycleLedgerEntry.create({
      data: {
        cycleId: openCycle.id,
        participationId: normalOpenParticipation.id,
        entryType: "deposit",
        amount: "3000000000.00",
        memo: `Participation deposit ${normal.characterName}`,
        occurredAt: daysFromBase(-6),
      },
    }),
    prisma.cycleLedgerEntry.create({
      data: {
        cycleId: openCycle.id,
        participationId: jingleYieldRootParticipation.id,
        entryType: "deposit",
        amount: "2000000000.00",
        memo: `JingleYield seed participation ${jingleYield.characterName}`,
        occurredAt: daysFromBase(-6),
      },
    }),
    prisma.cycleLedgerEntry.create({
      data: {
        cycleId: openCycle.id,
        participationId: fullPayoutSourceParticipation.id,
        entryType: "deposit",
        amount: "2000000000.00",
        memo: `Participation deposit ${fullPayout.characterName}`,
        occurredAt: daysFromBase(-6),
      },
    }),
    prisma.cycleLedgerEntry.create({
      data: {
        cycleId: openCycle.id,
        participationId: customRolloverSourceParticipation.id,
        entryType: "deposit",
        amount: "4000000000.00",
        memo: `Participation deposit ${customRollover.characterName}`,
        occurredAt: daysFromBase(-6),
      },
    }),
    prisma.cycleLedgerEntry.create({
      data: {
        cycleId: openCycle.id,
        participationId: refundParticipation.id,
        entryType: "withdrawal",
        amount: "1000000000.00",
        memo: `Participation refund ${refund.characterName}`,
        occurredAt: daysFromBase(-5),
      },
    }),
    prisma.cycleFeeEvent.create({
      data: {
        cycleId: openCycle.id,
        feeType: "transport",
        amountIsk: "50000000.00",
        memo: "Acceptance transport fee",
        occurredAt: daysFromBase(-4),
      },
    }),
    prisma.cycleFeeEvent.create({
      data: {
        cycleId: openCycle.id,
        feeType: "collateral_recovery",
        amountIsk: "-25000000.00",
        memo: "Acceptance collateral recovery",
        occurredAt: daysFromBase(-3),
      },
    }),
    prisma.cycleSnapshot.create({
      data: {
        cycleId: openCycle.id,
        snapshotAt: daysFromBase(-1),
        walletCashIsk: "7000000000.00",
        inventoryIsk: "640000000.00",
        cycleProfitIsk: "180000000.00",
      },
    }),
  ]);

  await Promise.all([
    prisma.walletTransaction.create({
      data: {
        characterId: TRADECRAFT_ACCEPTANCE_SEED.logistics.characterId,
        transactionId: 9910100001n,
        date: daysFromBase(-6),
        isBuy: true,
        locationId: TRADECRAFT_ACCEPTANCE_SEED.market.destinationStationId,
        typeId: TRADECRAFT_ACCEPTANCE_SEED.market.typeId,
        quantity: 100,
        unitPrice: "10000000.00",
      },
    }),
    prisma.walletTransaction.create({
      data: {
        characterId: TRADECRAFT_ACCEPTANCE_SEED.logistics.characterId,
        transactionId: 9910100002n,
        date: daysFromBase(-2),
        isBuy: false,
        locationId: TRADECRAFT_ACCEPTANCE_SEED.market.destinationStationId,
        typeId: TRADECRAFT_ACCEPTANCE_SEED.market.typeId,
        quantity: 60,
        unitPrice: "15000000.00",
      },
    }),
  ]);

  await Promise.all([
    prisma.buyAllocation.create({
      data: {
        walletCharacterId: TRADECRAFT_ACCEPTANCE_SEED.logistics.characterId,
        walletTransactionId: 9910100001n,
        lineId: cycleLine.id,
        quantity: 100,
        unitPrice: "10000000.00",
      },
    }),
    prisma.sellAllocation.create({
      data: {
        walletCharacterId: TRADECRAFT_ACCEPTANCE_SEED.logistics.characterId,
        walletTransactionId: 9910100002n,
        lineId: cycleLine.id,
        quantity: 60,
        unitPrice: "15000000.00",
        revenueIsk: "900000000.00",
        taxIsk: "45000000.00",
      },
    }),
  ]);

  await Promise.all([
    prisma.walletJournalEntry.create({
      data: {
        characterId: TRADECRAFT_ACCEPTANCE_SEED.logistics.characterId,
        journalId: 9910100101n,
        date: daysFromBase(-1),
        refType: "player_donation",
        amount: "2500000000.00",
        balance: "12000000000.00",
        description: "Acceptance Participation payment",
        reason: paymentMatchParticipation.memo,
        firstPartyId: paymentMatch.characterId,
      },
    }),
    prisma.walletJournalEntry.create({
      data: {
        characterId: TRADECRAFT_ACCEPTANCE_SEED.logistics.characterId,
        journalId: 9910100102n,
        date: daysFromBase(-1),
        refType: "player_donation",
        amount: "123456789.00",
        balance: "12123456789.00",
        description: "Acceptance unmatched donation",
        reason: "UNMATCHED-ACCEPTANCE-DONATION",
        firstPartyId: normal.characterId,
      },
    }),
  ]);

  return {
    adminUserId,
    logisticsCharacterId: TRADECRAFT_ACCEPTANCE_SEED.logistics.characterId,
    cycles: {
      completedCycleId: completedCycle.id,
      openCycleId: openCycle.id,
      plannedCycleId: plannedCycle.id,
    },
    participations: {
      normalOpenParticipationId: normalOpenParticipation.id,
      paymentMatchParticipationId: paymentMatchParticipation.id,
      fullPayoutSourceParticipationId: fullPayoutSourceParticipation.id,
      fullPayoutTargetParticipationId: fullPayoutTargetParticipation.id,
      customRolloverSourceParticipationId: customRolloverSourceParticipation.id,
      customRolloverTargetParticipationId: customRolloverTargetParticipation.id,
      jingleYieldRootParticipationId: jingleYieldRootParticipation.id,
      refundParticipationId: refundParticipation.id,
    },
    jingleYieldProgramId: jingleYieldProgram.id,
    cycleLineId: cycleLine.id,
    walletJournalIds: {
      paymentMatchJournalId: "9910100101",
      unmatchedJournalId: "9910100102",
    },
  };
}
