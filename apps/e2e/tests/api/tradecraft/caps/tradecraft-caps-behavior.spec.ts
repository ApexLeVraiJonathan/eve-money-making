import { test, expect } from "@playwright/test";
import { createApiCall } from "../../../../testkit/api";
import { createPrisma, ensureE2eAdmin, resetTradecraftData } from "../../../../testkit/db";

function apiUrl() {
  return process.env.API_URL ?? "http://localhost:3000";
}

function apiKey() {
  return process.env.E2E_API_KEY ?? "";
}

test.describe("Tradecraft caps behavior (API)", () => {
  test("defaults for a new user with null overrides are 10B principal / 20B maximum", async ({
    request,
  }) => {
    const prisma = createPrisma();
    try {
      await ensureE2eAdmin(prisma);
      await resetTradecraftData(prisma);

      const userId = `e2e-caps-default-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2, 8)}`;
      await prisma.user.create({ data: { id: userId, role: "USER" } });

      const api = createApiCall(request);
      const caps = await api<{
        principalCapB: number;
        effectivePrincipalCapB: number;
        maximumCapB: number;
      }>("GET", `/ledger/participations/max-amount?testUserId=${userId}`);

      expect(caps.principalCapB).toBe(10);
      expect(caps.effectivePrincipalCapB).toBe(10);
      expect(caps.maximumCapB).toBe(20);
    } finally {
      await prisma.$disconnect();
    }
  });

  test("principal cap is enforced on create + increase (admin user)", async ({
    request,
  }) => {
    const prisma = createPrisma();
    try {
      const adminUserId = await ensureE2eAdmin(prisma);
      await resetTradecraftData(prisma);

      const api = createApiCall(request);

      // Tight caps so we can hit errors quickly
      await api("PATCH", `/admin/users/${adminUserId}/tradecraft-caps`, {
        principalCapIsk: "5000000000.00", // 5B
        maximumCapIsk: "6000000000.00", // 6B
      });

      const planned = await api<{ id: string }>("POST", "/ledger/cycles/plan", {
        name: "E2E Planned Cycle (principal cap)",
        startedAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

      // Create above principal cap -> 400
      const resTooHigh = await request.fetch(
        `${apiUrl()}/ledger/cycles/${planned.id}/participations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey(),
          },
          data: { amountIsk: "6000000000.00" },
        },
      );
      expect(resTooHigh.ok()).toBe(false);
      expect(resTooHigh.status()).toBe(400);
      expect(await resTooHigh.text()).toContain(
        "Participation principal exceeds maximum allowed",
      );

      // Create at principal cap -> OK
      const created = await api<{ id: string }>(
        "POST",
        `/ledger/cycles/${planned.id}/participations`,
        { amountIsk: "5000000000.00" },
      );

      // Increase by 1B -> exceeds principal cap -> 400
      const resIncrease = await request.fetch(
        `${apiUrl()}/ledger/participations/${created.id}/increase`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey(),
          },
          data: { deltaAmountIsk: "1000000000.00" },
        },
      );
      expect(resIncrease.ok()).toBe(false);
      expect(resIncrease.status()).toBe(400);
      expect(await resIncrease.text()).toContain(
        "Participation principal exceeds maximum allowed",
      );
    } finally {
      await prisma.$disconnect();
    }
  });

  test("JingleYield locked principal reduces effective principal cap", async ({
    request,
  }) => {
    const prisma = createPrisma();
    try {
      const adminUserId = await ensureE2eAdmin(prisma);
      await resetTradecraftData(prisma);

      const api = createApiCall(request);

      // Base caps: 10B principal / 20B max
      await api("PATCH", `/admin/users/${adminUserId}/tradecraft-caps`, {
        principalCapIsk: "10000000000.00",
        maximumCapIsk: "20000000000.00",
      });

      const planned1 = await api<{ id: string }>("POST", "/ledger/cycles/plan", {
        name: "E2E Planned Cycle (JY)",
        startedAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

      const admin = await prisma.user.findUnique({
        where: { id: adminUserId },
        select: { primaryCharacterId: true },
      });
      if (!admin?.primaryCharacterId) {
        throw new Error("E2E admin user is missing a primaryCharacterId");
      }

      // Create JingleYield participation with 9B locked principal.
      await api("POST", "/ledger/jingle-yield/participations", {
        userId: adminUserId,
        cycleId: planned1.id,
        adminCharacterId: admin.primaryCharacterId,
        characterName: "E2E Admin",
        principalIsk: "9000000000.00",
      });

      const caps = await api<{
        principalCapB: number;
        effectivePrincipalCapB: number;
        maximumCapB: number;
      }>("GET", "/ledger/participations/max-amount");

      expect(caps.principalCapB).toBe(10);
      expect(caps.maximumCapB).toBe(20);
      expect(caps.effectivePrincipalCapB).toBe(1); // 10B - 9B

      // A different planned cycle should block opt-in above the effective cap.
      const planned2 = await api<{ id: string }>("POST", "/ledger/cycles/plan", {
        name: "E2E Planned Cycle 2 (JY)",
        startedAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
      });

      const resTooHigh = await request.fetch(
        `${apiUrl()}/ledger/cycles/${planned2.id}/participations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey(),
          },
          data: { amountIsk: "2000000000.00" }, // 2B > 1B effective cap
        },
      );
      expect(resTooHigh.ok()).toBe(false);
      expect(resTooHigh.status()).toBe(400);
      expect(await resTooHigh.text()).toContain(
        "Participation principal exceeds maximum allowed",
      );
    } finally {
      await prisma.$disconnect();
    }
  });
});


