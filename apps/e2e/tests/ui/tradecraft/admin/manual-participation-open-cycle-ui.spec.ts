import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { createPrisma, ensureE2eAdmin, resetTradecraftData } from "../../../../testkit/db";

test.describe("Admin manual participation (OPEN cycle) (UI)", () => {
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
      const session = cookies.find((c) => c?.name === "session" && typeof c?.value === "string" && c.value.length > 0);
      if (!session || (session.value ?? "").includes("%")) {
        test.skip(
          true,
          "UI storageState is missing a usable `session` cookie. Recreate it with:\n  pnpm -C apps/e2e test:setup",
        );
      }
    } catch {
      test.skip(true, "UI storageState is invalid JSON. Recreate it with:\n  pnpm -C apps/e2e test:setup");
    }
  });

  test("admin can create a participation from the admin UI and see it in the list", async ({
    page,
  }) => {
    test.skip(
      !process.env.ENCRYPTION_KEY,
      "ENCRYPTION_KEY is required for UI tests (session cookie auth). Add it to apps/e2e/.env to enable this test.",
    );

    const prisma = createPrisma();
    const now = Date.now();
    const userId =
      process.env.E2E_TARGET_USER_ID ??
      "c371bf5e-028b-4dd7-a347-137f6196a48a";
    const openCycleName = `E2E UI Open Cycle ${String(now).slice(-6)}`;
    try {
      await ensureE2eAdmin(prisma);
      await resetTradecraftData(prisma);

      // Ensure the target user exists and has a primary character.
      const existing = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, primaryCharacter: { select: { id: true, name: true } } },
      });
      if (!existing) {
        await prisma.user.create({ data: { id: userId, role: "USER" } });
      }

      const ensuredUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { primaryCharacterId: true, primaryCharacter: { select: { id: true, name: true } } },
      });

      const primaryCharacterId =
        ensuredUser?.primaryCharacterId ??
        (99_000_000 + (now % 1_000_000) + 1);
      const primaryName =
        ensuredUser?.primaryCharacter?.name ??
        `E2E UI Manual ${String(now).slice(-6)}`;

      if (!ensuredUser?.primaryCharacterId) {
        // Create a deterministic primary character for the target user and set it.
        await prisma.eveCharacter.create({
          data: {
            id: primaryCharacterId,
            name: primaryName,
            ownerHash: `e2e-owner-${userId}-${now}`,
            userId,
          },
        });
        await prisma.user.update({
          where: { id: userId },
          data: { primaryCharacterId },
        });
      }

      // Seed an OPEN cycle that will receive the manual participation.
      const openCycle = await prisma.cycle.create({
        data: {
          name: openCycleName,
          status: "OPEN",
          startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          initialCapitalIsk: "0.00",
        },
        select: { id: true },
      });

      await page.goto("/tradecraft/admin/participations", { waitUntil: "networkidle" });

      // If auth is missing, skip with a helpful message.
      const signInButton = page.getByRole("button", { name: /Sign in with EVE/i });
      if (await signInButton.isVisible().catch(() => false)) {
        test.skip(true, "UI test is not authenticated (Sign in with EVE visible). Run:\n  pnpm -C apps/e2e test:setup");
      }

      await expect(
        page.getByRole("heading", { name: "Participations", exact: true }),
      ).toBeVisible();

      // Manual card should be present.
      await expect(page.getByText("Manual Participation (OPEN cycle)")).toBeVisible();

      // Select the OPEN cycle explicitly (avoid relying on default selection).
      await page.getByRole("combobox", { name: /Open cycle/i }).click();
      await page.getByRole("option", { name: openCycleName }).click();

      // Filter and select the main character.
      await page.getByPlaceholder(/Search main character/i).fill(primaryName);

      // The second combobox in the manual card is the user select (main character).
      await page.getByRole("combobox", { name: /Select main character/i }).click();
      await page.getByRole("option", { name: new RegExp(primaryName) }).click();

      // Enter 5B and create.
      await page.getByLabel("Amount (B ISK)").fill("5");
      await page.getByRole("button", { name: "Create participation" }).click();

      // Verify it appears in the All Participants table for the OPEN cycle.
      await expect(page.getByText(openCycleName)).toBeVisible();
      await expect(page.getByText(primaryName).first()).toBeVisible();
      await expect(
        page.getByText("5,000,000,000.00 ISK", { exact: true }).first(),
      ).toBeVisible();
      await expect(page.getByText("Confirmed").first()).toBeVisible();

      // Verify DB state: participation exists and cycle initial capital increased.
      const dbCycle = await prisma.cycle.findUnique({
        where: { id: openCycle.id },
        select: { initialCapitalIsk: true },
      });
      expect(Number(dbCycle?.initialCapitalIsk ?? 0)).toBe(5_000_000_000);
    } finally {
      await prisma.$disconnect();
    }
  });
});

