import { PrismaClient } from "@eve/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { envOr } from "./env";

export function createPrisma() {
  const dbUrl =
    envOr(
      "DATABASE_URL",
      "postgresql://postgres:postgres@localhost:5433/eve_money_dev?schema=public",
    );

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: dbUrl }),
  });
}

export async function resetTradecraftData(prisma: PrismaClient) {
  // Keep users/characters/etc. intact; this is meant to clear tradecraft state.
  await prisma.autoRolloverSettings.deleteMany({});
  await prisma.sellAllocation.deleteMany({});
  await prisma.buyAllocation.deleteMany({});
  await prisma.packageCycleLine.deleteMany({});
  await prisma.committedPackage.deleteMany({});
  await prisma.cycleLine.deleteMany({});
  await prisma.cycleFeeEvent.deleteMany({});
  await prisma.cycleSnapshot.deleteMany({});
  await prisma.cycleLedgerEntry.deleteMany({});
  await prisma.jingleYieldProgram.deleteMany({});
  await prisma.cycleParticipation.deleteMany({});
  await prisma.cycleCapitalCache.deleteMany({});
  await prisma.cycle.deleteMany({});
}

export async function ensureE2eAdmin(prisma: PrismaClient) {
  // DevApiKeyStrategy will use the first eveCharacter whose user.role === 'ADMIN'.
  // Ensure one exists so x-api-key requests have a real, FK-valid userId.
  const existing = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true, primaryCharacterId: true },
  });
  if (existing) return existing.id;

  const userId = "e2e-admin-user";
  const characterId = 99000001;

  await prisma.user.create({
    data: {
      id: userId,
      role: "ADMIN",
      primaryCharacterId: characterId,
      primaryCharacter: {
        create: {
          id: characterId,
          name: "E2E Admin",
          ownerHash: "e2e-owner-hash",
          role: "USER",
          managedBy: "SYSTEM",
        },
      },
    },
  });

  return userId;
}


