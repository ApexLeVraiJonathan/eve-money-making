import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  createPrisma,
  ensureE2eAdmin,
  resetTradecraftData,
} from "../../../../testkit/db";

test.describe("Tradecraft user caps (UI)", () => {
  test.beforeEach(() => {
    const storageStatePath = path.join(
      __dirname,
      "..",
      "..",
      "..",
      ".playwright",
      "storageState.json"
    );
    if (!fs.existsSync(storageStatePath)) {
      test.skip(
        true,
        "No UI storageState found. Run:\n  pnpm -C apps/e2e test:setup"
      );
    }

    try {
      const raw = fs.readFileSync(storageStatePath, "utf8");
      const parsed = JSON.parse(raw) as {
        cookies?: Array<{ name?: string; value?: string }>;
      };
      const cookies = Array.isArray(parsed.cookies) ? parsed.cookies : [];
      const session = cookies.find(
        (c) =>
          c?.name === "session" &&
          typeof c?.value === "string" &&
          c.value.length > 0
      );
      if (!session || session.value.includes("%")) {
        test.skip(
          true,
          "UI storageState is missing a usable `session` cookie. Recreate it with:\n  pnpm -C apps/e2e test:setup"
        );
      }
    } catch {
      test.skip(
        true,
        "UI storageState is invalid JSON. Recreate it with:\n  pnpm -C apps/e2e test:setup"
      );
    }
  });

  test("loads Tradecraft users page and shows cap editor", async ({ page }) => {
    test.skip(
      !process.env.ENCRYPTION_KEY,
      "ENCRYPTION_KEY is required for UI tests (session cookie auth). Add it to apps/e2e/.env to enable this test."
    );

    const prisma = createPrisma();
    try {
      await ensureE2eAdmin(prisma);
      await resetTradecraftData(prisma);

      // Idempotent: don't collide with previous local runs.
      const userId = `e2e-ui-tradecraft-user-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;
      const cycle = await prisma.cycle.create({
        data: {
          name: `E2E UI Planned Cycle ${userId}`,
          status: "PLANNED",
          startedAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          initialCapitalIsk: "1000000000.00",
        },
        select: { id: true },
      });
      await prisma.user.create({ data: { id: userId, role: "USER" } });
      await prisma.cycleParticipation.create({
        data: {
          cycleId: cycle.id,
          userId,
          characterName: "E2E UI User",
          amountIsk: "1000000000.00",
          memo: `ARB-${cycle.id.substring(0, 8)}-${userId.substring(0, 8)}`,
          status: "AWAITING_INVESTMENT",
        },
      });

      await page.goto("/tradecraft/admin/users", { waitUntil: "networkidle" });
      await expect(
        page.getByRole("heading", { name: "Tradecraft Users" })
      ).toBeVisible();
      await expect(page.getByPlaceholder(/Filter by email/i)).toBeVisible();

      // Row should include our user id and cap editor.
      // userId appears twice (name + monospace detail), so target the primary cell.
      await expect(
        page.locator("div.font-medium", { hasText: userId })
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Save" }).first()
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "10B" }).first()
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "20B" }).first()
      ).toBeVisible();
    } finally {
      await prisma.$disconnect();
    }
  });
});
