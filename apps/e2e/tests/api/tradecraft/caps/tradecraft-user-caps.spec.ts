import { test, expect } from "@playwright/test";
import { createApiCall } from "../../../../testkit/api";
import {
  createPrisma,
  ensureE2eAdmin,
  resetTradecraftData,
} from "../../../../testkit/db";

test.describe("Tradecraft user caps (API)", () => {
  test("admin can list Tradecraft users and set per-user max participation override; override affects max-amount + participation creation", async ({
    request,
  }) => {
    const prisma = createPrisma();
    try {
      await ensureE2eAdmin(prisma);
      await resetTradecraftData(prisma);

      // Seed a Tradecraft user with a participation so they appear in the list.
      const userId = `e2e-tradecraft-user-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2, 8)}`;
      await prisma.user.create({
        data: { id: userId, role: "USER" },
      });

      const cycle = await prisma.cycle.create({
        data: {
          name: "E2E Planned Cycle",
          status: "PLANNED",
          startedAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          initialCapitalIsk: "1000000000.00",
        },
        select: { id: true },
      });

      const cycle2 = await prisma.cycle.create({
        data: {
          name: "E2E Planned Cycle 2",
          status: "PLANNED",
          startedAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
          initialCapitalIsk: "1000000000.00",
        },
        select: { id: true },
      });

      await prisma.cycleParticipation.create({
        data: {
          cycleId: cycle.id,
          userId,
          characterName: "E2E User",
          amountIsk: "1000000000.00",
          memo: `ARB-${cycle.id.substring(0, 8)}-${userId.substring(0, 8)}`,
          status: "AWAITING_INVESTMENT",
        },
      });

      const api = createApiCall(request);

      const list = await api<
        Array<{
          id: string;
          tradecraftPrincipalCapIsk: string | null;
          tradecraftMaximumCapIsk: string | null;
        }>
      >("GET", "/admin/users/tradecraft?limit=500");

      const found = list.find((u) => u.id === userId);
      expect(found).toBeTruthy();
      expect(found!.tradecraftPrincipalCapIsk).toBeNull();
      expect(found!.tradecraftMaximumCapIsk).toBeNull();

      // Set principal cap to 15B and maximum cap to 250B (admin can exceed default 20B)
      const updated = await api<{
        id: string;
        tradecraftPrincipalCapIsk: string | null;
        tradecraftMaximumCapIsk: string | null;
      }>("PATCH", `/admin/users/${userId}/tradecraft-caps`, {
        principalCapIsk: "15000000000.00",
        maximumCapIsk: "250000000000.00",
      });
      expect(updated.id).toBe(userId);
      expect(updated.tradecraftPrincipalCapIsk).toBeTruthy();
      expect(updated.tradecraftMaximumCapIsk).toBeTruthy();

      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { tradecraftPrincipalCapIsk: true, tradecraftMaximumCapIsk: true },
      });
      expect(Number(dbUser?.tradecraftPrincipalCapIsk ?? 0)).toBe(15_000_000_000);
      expect(Number(dbUser?.tradecraftMaximumCapIsk ?? 0)).toBe(250_000_000_000);

      // The dev-only max endpoint supports testUserId.
      const max = await api<{
        principalCapB: number;
        effectivePrincipalCapB: number;
        maximumCapB: number;
      }>(
        "GET",
        `/ledger/participations/max-amount?testUserId=${userId}`,
      );
      expect(max.principalCapB).toBe(15);
      expect(max.effectivePrincipalCapB).toBe(15);
      expect(max.maximumCapB).toBe(250);

      // Creating a participation above the principal cap should fail.
      // We can't use createApiCall (it throws on non-2xx), so use request.fetch directly.
      const res = await request.fetch(
        `${process.env.API_URL ?? "http://localhost:3000"}/ledger/cycles/${
          cycle2.id
        }/participations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.E2E_API_KEY ?? "",
          },
          data: {
            amountIsk: "16000000000.00",
            testUserId: userId,
          },
        },
      );
      expect(res.ok()).toBe(false);
      expect(res.status()).toBe(400);
      const body = await res.text();
      expect(body).toContain("Participation principal exceeds maximum allowed");
    } finally {
      await prisma.$disconnect();
    }
  });
});


