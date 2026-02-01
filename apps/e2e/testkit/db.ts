import { CharacterManagedBy, CharacterRole, PrismaClient } from "@eve/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { envOr } from "./env";

export function createPrisma() {
  const dbUrl = envOr(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5433/eve_money_dev?schema=public",
  );

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: dbUrl }),
  });
}

export async function resetTradecraftData(prisma: PrismaClient) {
  // Keep users/characters/etc. intact; this is meant to clear tradecraft state.
  // Clear wallet imports too so allocation/close-cycle flows are deterministic in E2E.
  await prisma.walletTransaction.deleteMany({});
  await prisma.walletJournalEntry.deleteMany({});
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

  // Create in 3 steps to avoid mixing unchecked FK fields with nested writes.
  await prisma.user.create({
    data: {
      id: userId,
      role: "ADMIN",
    },
  });
  await prisma.eveCharacter.create({
    data: {
      id: characterId,
      name: "E2E Admin",
      ownerHash: "e2e-owner-hash",
      role: CharacterRole.USER,
      managedBy: CharacterManagedBy.SYSTEM,
      userId,
    },
  });
  await prisma.user.update({
    where: { id: userId },
    data: { primaryCharacterId: characterId },
  });

  return userId;
}
