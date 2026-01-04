import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { createPrisma, ensureE2eAdmin, resetTradecraftData } from "../../../../testkit/db";

test.describe("Tradecraft admin participations (UI - visual scenario)", () => {
  test.beforeEach(() => {
    const storageStatePath = path.join(
      __dirname,
      "..",
      "..",
      "..",
      "..",
      ".playwright",
      "storageState.json",
    );
    if (!fs.existsSync(storageStatePath)) {
      test.skip(true, "No UI storageState found. Run:\n  pnpm -C apps/e2e test:setup");
    }

    try {
      const raw = fs.readFileSync(storageStatePath, "utf8");
      const parsed = JSON.parse(raw) as { cookies?: Array<{ name?: string; value?: string }> };
      const cookies = Array.isArray(parsed.cookies) ? parsed.cookies : [];

      let sessionValue: string | undefined;
      for (const c of cookies) {
        if (c?.name === "session" && typeof c.value === "string") {
          sessionValue = c.value;
          break;
        }
      }

      if (!sessionValue || sessionValue.length === 0 || sessionValue.includes("%")) {
        test.skip(
          true,
          "UI storageState is missing a usable `session` cookie. Recreate it with:\n  pnpm -C apps/e2e test:setup",
        );
      }
    } catch {
      test.skip(true, "UI storageState is invalid JSON. Recreate it with:\n  pnpm -C apps/e2e test:setup");
    }
  });

  test("seed mixed participation types + statuses and screenshot admin participations page", async (
    { page },
    testInfo,
  ) => {
    test.skip(
      !process.env.ENCRYPTION_KEY,
      "ENCRYPTION_KEY is required for UI tests (session cookie auth). Add it to apps/e2e/.env to enable this test.",
    );

    const prisma = createPrisma();
    try {
      const adminUserId = await ensureE2eAdmin(prisma);
      await resetTradecraftData(prisma);

      const runId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

      // Cycles: past completed, current open, planned
      const completedCycle = await prisma.cycle.create({
        data: {
          name: `E2E Completed Cycle ${runId}`,
          status: "COMPLETED",
          startedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
          closedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          initialCapitalIsk: "1000000000.00",
        },
        select: { id: true },
      });

      const openCycle = await prisma.cycle.create({
        data: {
          name: `E2E Open Cycle ${runId}`,
          status: "OPEN",
          startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          initialCapitalIsk: "1000000000.00",
        },
        select: { id: true },
      });

      const plannedCycle = await prisma.cycle.create({
        data: {
          name: `E2E Planned Cycle ${runId}`,
          status: "PLANNED",
          startedAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          initialCapitalIsk: "1000000000.00",
        },
        select: { id: true },
      });

      // Users (unique per run)
      const standardUserId = `e2e-ui-std-${runId}`;
      const refundUserId = `e2e-ui-refund-${runId}`;
      const payoutUserId = `e2e-ui-payout-${runId}`;
      const jyUserId = `e2e-ui-jy-${runId}`;

      await prisma.user.createMany({
        data: [
          { id: standardUserId, role: "USER" },
          { id: refundUserId, role: "USER" },
          { id: payoutUserId, role: "USER" },
          { id: jyUserId, role: "USER" },
        ],
        skipDuplicates: true,
      });

      // Logistics character + journal entries so "Unmatched Donations" has data.
      const logisticsCharacterId = 99012345;
      await prisma.eveCharacter.upsert({
        where: { id: logisticsCharacterId },
        update: { name: "E2E Logistics", role: "LOGISTICS", managedBy: "SYSTEM" },
        create: {
          id: logisticsCharacterId,
          name: "E2E Logistics",
          ownerHash: `e2e-logi-${runId}`,
          role: "LOGISTICS",
          managedBy: "SYSTEM",
        },
        select: { id: true },
      });

      const linkedJournalId = BigInt(Date.now());
      const unmatchedJournalId = linkedJournalId + 1n;

      await prisma.walletJournalEntry.createMany({
        data: [
          {
            characterId: logisticsCharacterId,
            journalId: linkedJournalId,
            date: new Date(Date.now() - 60 * 1000),
            refType: "player_donation",
            amount: "2000000000.00",
            description: `Donation (linked) ${runId}`,
            reason: `Linked donation ${runId}`,
          },
          {
            characterId: logisticsCharacterId,
            journalId: unmatchedJournalId,
            date: new Date(Date.now() - 30 * 1000),
            refType: "player_donation",
            amount: "1500000000.00",
            description: `Donation (unmatched) ${runId}`,
            reason: `Unmatched donation ${runId}`,
          },
        ],
        skipDuplicates: true,
      });

      // AWAITING_INVESTMENT -> Manual Payment Matching + All Participants
      await prisma.cycleParticipation.create({
        data: {
          cycleId: plannedCycle.id,
          userId: standardUserId,
          characterName: `E2E Standard ${runId}`,
          amountIsk: "2000000000.00",
          userPrincipalIsk: "2000000000.00",
          memo: `ARB-${plannedCycle.id.substring(0, 8)}-${standardUserId.substring(0, 8)}`,
          status: "AWAITING_INVESTMENT",
        },
      });

      // OPTED_OUT + !refundedAt -> Refunds Needed
      await prisma.cycleParticipation.create({
        data: {
          cycleId: plannedCycle.id,
          userId: refundUserId,
          characterName: `E2E Refund ${runId}`,
          amountIsk: "3000000000.00",
          userPrincipalIsk: "3000000000.00",
          memo: `ARB-${plannedCycle.id.substring(0, 8)}-${refundUserId.substring(0, 8)}`,
          status: "OPTED_OUT",
          refundAmountIsk: "3000000000.00",
          optedOutAt: new Date(),
        },
      });

      // AWAITING_PAYOUT + payoutAmountIsk -> Payouts Needed
      //
      // Realistic case: ~10% profit, with rollover set to INITIAL_ONLY.
      // Investment = 10B, Total payout = 11B => roll over 10B (initial), pay out 1B (profit).
      const payoutFrom = await prisma.cycleParticipation.create({
        data: {
          cycleId: completedCycle.id,
          userId: payoutUserId,
          characterName: `E2E Payout ${runId}`,
          amountIsk: "10000000000.00",
          userPrincipalIsk: "10000000000.00",
          memo: `ARB-${completedCycle.id.substring(0, 8)}-${payoutUserId.substring(0, 8)}`,
          status: "AWAITING_PAYOUT",
          payoutAmountIsk: "1000000000.00",
          rolloverDeductedIsk: "10000000000.00",
        },
        select: { id: true },
      });

      // Create the corresponding planned-cycle rollover participation to visually confirm
      // the "Rollover (INITIAL)" type in the All Participants section.
      await prisma.cycleParticipation.create({
        data: {
          cycleId: plannedCycle.id,
          userId: payoutUserId,
          characterName: `E2E Payout ${runId}`,
          amountIsk: "10000000000.00",
          userPrincipalIsk: "10000000000.00",
          memo: `ROLLOVER-${plannedCycle.id.substring(0, 8)}-${payoutFrom.id.substring(0, 8)}-INITIAL`,
          status: "OPTED_IN",
          rolloverType: "INITIAL_ONLY",
          rolloverRequestedAmountIsk: "10000000000.00",
          rolloverFromParticipationId: payoutFrom.id,
        },
      });

      // Rollover participation (planned cycle)
      const rolloverFrom = await prisma.cycleParticipation.create({
        data: {
          cycleId: openCycle.id,
          userId: adminUserId,
          characterName: `E2E Rollover Source ${runId}`,
          amountIsk: "5000000000.00",
          userPrincipalIsk: "5000000000.00",
          memo: `ARB-${openCycle.id.substring(0, 8)}-${adminUserId.substring(0, 8)}`,
          status: "OPTED_IN",
          validatedAt: new Date(),
          walletJournalId: linkedJournalId, // show "Linked" in All Participants payment column
        },
        select: { id: true },
      });

      await prisma.cycleParticipation.create({
        data: {
          cycleId: plannedCycle.id,
          userId: adminUserId,
          characterName: `E2E Rollover ${runId}`,
          amountIsk: "5000000000.00",
          userPrincipalIsk: "5000000000.00",
          memo: `ROLLOVER-${plannedCycle.id.substring(0, 8)}-${rolloverFrom.id.substring(0, 8)}-INITIAL`,
          status: "OPTED_IN",
          rolloverType: "INITIAL_ONLY",
          rolloverRequestedAmountIsk: "5000000000.00",
          rolloverFromParticipationId: rolloverFrom.id,
        },
      });

      // JingleYield program + participation(s)
      const admin = await prisma.user.findUnique({
        where: { id: adminUserId },
        select: { primaryCharacterId: true },
      });
      if (!admin?.primaryCharacterId) {
        throw new Error("E2E admin user is missing a primaryCharacterId");
      }

      const jyRoot = await prisma.cycleParticipation.create({
        data: {
          cycleId: openCycle.id,
          userId: jyUserId,
          characterName: `E2E JingleYield ${runId}`,
          amountIsk: "2000000000.00",
          userPrincipalIsk: "0.00",
          memo: `JY-${openCycle.id.substring(0, 8)}-${jyUserId.substring(0, 8)}`,
          status: "OPTED_IN",
          validatedAt: new Date(),
        },
        select: { id: true },
      });

      const jyProgram = await prisma.jingleYieldProgram.create({
        data: {
          userId: jyUserId,
          adminCharacterId: admin.primaryCharacterId,
          rootParticipationId: jyRoot.id,
          lockedPrincipalIsk: "2000000000.00",
          startCycleId: openCycle.id,
          status: "ACTIVE",
          minCycles: 12,
        },
        select: { id: true },
      });

      await prisma.cycleParticipation.update({
        where: { id: jyRoot.id },
        data: { jingleYieldProgramId: jyProgram.id },
      });

      await prisma.cycleParticipation.create({
        data: {
          cycleId: plannedCycle.id,
          userId: jyUserId,
          characterName: `E2E JingleYield ${runId}`,
          amountIsk: "2000000000.00",
          userPrincipalIsk: "0.00",
          memo: `JY-${plannedCycle.id.substring(0, 8)}-${jyUserId.substring(0, 8)}`,
          status: "AWAITING_INVESTMENT",
          jingleYieldProgramId: jyProgram.id,
        },
      });

      await page.goto("/tradecraft/admin/participations", { waitUntil: "networkidle" });
      await expect(page.getByRole("heading", { name: "Participations" })).toBeVisible();

      // Section titles use CardTitle (not guaranteed to be a semantic "heading" role).
      await expect(page.getByRole("button", { name: "Manage user caps" })).toBeVisible();
      await expect(page.getByText("All Participants", { exact: true })).toBeVisible();

      await expect(page.getByText("JingleYield").first()).toBeVisible();
      await expect(page.getByText("Rollover (INITIAL)").first()).toBeVisible();
      await expect(page.getByText("Manual Payment Matching", { exact: true })).toBeVisible();
      await expect(page.getByText("Refunds Needed", { exact: true }).first()).toBeVisible();
      await expect(page.getByText("Payouts Needed", { exact: true }).first()).toBeVisible();

      if (process.env.E2E_UI_DEBUG === "1") {
        await page.pause();
      }

      await testInfo.attach("admin-participations-default", {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
      });

      await page.locator("#showPastCycles").click();
      await testInfo.attach("admin-participations-with-past-cycles", {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
      });
    } finally {
      await prisma.$disconnect();
    }
  });
});


