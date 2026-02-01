import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  createPrisma,
  ensureE2eAdmin,
  resetTradecraftData,
} from "../../../testkit/db";

test.describe("Auto rollover (UI)", () => {
  test.beforeEach(() => {
    const storageStatePath = path.join(
      __dirname,
      "..",
      "..",
      "..",
      ".playwright",
      "storageState.json",
    );
    if (!fs.existsSync(storageStatePath)) {
      test.skip(
        true,
        "No UI storageState found. Run:\n  pnpm -C apps/e2e test:setup",
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
          c.value.length > 0,
      );
      if (!session || (session.value ?? "").includes("%")) {
        test.skip(
          true,
          "UI storageState is missing a usable `session` cookie. Recreate it with:\n  pnpm -C apps/e2e test:setup",
        );
      }
    } catch {
      test.skip(
        true,
        "UI storageState is invalid JSON. Recreate it with:\n  pnpm -C apps/e2e test:setup",
      );
    }
  });

  async function openDialog(page: import("@playwright/test").Page) {
    await page.getByRole("button", { name: "Automatic rollover" }).click();
    await expect(
      page.getByRole("heading", { name: "Automatic rollover" }),
    ).toBeVisible();
  }

  async function saveDialog(page: import("@playwright/test").Page) {
    const saveResponsePromise = page.waitForResponse((r) => {
      const url = r.url();
      return (
        r.request().method() === "PATCH" &&
        url.includes("/ledger/participations/auto-rollover-settings")
      );
    });
    await page.getByRole("button", { name: "Save" }).click();
    const saveResponse = await saveResponsePromise;
    if (!saveResponse.ok()) {
      const body = await saveResponse.text().catch(() => "");
      throw new Error(
        `Save settings failed: ${saveResponse.status()} ${saveResponse.statusText()}\n${body}`,
      );
    }
    await expect(
      page.getByRole("heading", { name: "Automatic rollover" }),
    ).toBeHidden();
  }

  test("can enable automatic rollover from Cycles page and see badge update", async ({
    page,
  }) => {
    test.skip(
      !process.env.ENCRYPTION_KEY,
      "ENCRYPTION_KEY is required for UI tests (session cookie auth). Add it to apps/e2e/.env to enable this test.",
    );

    const prisma = createPrisma();
    try {
      await ensureE2eAdmin(prisma);
      await resetTradecraftData(prisma);

      await page.goto("/tradecraft/cycles", { waitUntil: "networkidle" });

      if (process.env.E2E_UI_DEBUG === "1") {
        await page.pause();
      }

      const signInButton = page.getByRole("button", {
        name: /Sign in with EVE/i,
      });
      if (await signInButton.isVisible().catch(() => false)) {
        if (process.env.E2E_UI_MANUAL_LOGIN === "1") {
          await page.pause();
        } else {
          throw new Error(
            "UI test is not authenticated (Sign in with EVE visible). " +
              "Set ENCRYPTION_KEY in apps/e2e/.env to match the API, " +
              "or rerun with E2E_UI_MANUAL_LOGIN=1 in headed mode.",
          );
        }
      }

      await expect(page.getByText(/Auto rollover:/)).toBeVisible();

      await openDialog(page);

      await page.getByLabel("Enable automatic rollover").check();
      await page.getByLabel("Initial investment only").click();

      await saveDialog(page);

      await expect(page.getByText("Auto rollover: Initial only")).toBeVisible();

      await page.reload({ waitUntil: "networkidle" });
      await expect(page.getByText("Auto rollover: Initial only")).toBeVisible();
    } finally {
      await prisma.$disconnect();
    }
  });

  test("can enable Full payout and see badge update + persistence", async ({
    page,
  }) => {
    const prisma = createPrisma();
    try {
      await ensureE2eAdmin(prisma);
      await resetTradecraftData(prisma);

      await page.goto("/tradecraft/cycles", { waitUntil: "networkidle" });
      await openDialog(page);

      await page.getByLabel("Enable automatic rollover").check();
      await page.getByLabel("Full payout (initial + profit)").click();

      await saveDialog(page);

      await expect(page.getByText("Auto rollover: Full payout")).toBeVisible();

      await page.reload({ waitUntil: "networkidle" });
      await expect(page.getByText("Auto rollover: Full payout")).toBeVisible();
    } finally {
      await prisma.$disconnect();
    }
  });

  test("can disable automatic rollover and see badge Off + persistence", async ({
    page,
  }) => {
    const prisma = createPrisma();
    try {
      await ensureE2eAdmin(prisma);
      await resetTradecraftData(prisma);

      await page.goto("/tradecraft/cycles", { waitUntil: "networkidle" });
      await openDialog(page);
      await page.getByLabel("Enable automatic rollover").check();
      await page.getByLabel("Initial investment only").click();
      await saveDialog(page);
      await expect(page.getByText("Auto rollover: Initial only")).toBeVisible();

      await openDialog(page);
      await page.getByLabel("Enable automatic rollover").uncheck();
      await saveDialog(page);

      await expect(page.getByText("Auto rollover: Off")).toBeVisible();

      await page.reload({ waitUntil: "networkidle" });
      await expect(page.getByText("Auto rollover: Off")).toBeVisible();
    } finally {
      await prisma.$disconnect();
    }
  });
});
