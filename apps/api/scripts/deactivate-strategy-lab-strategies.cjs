/**
 * Deactivate (soft-delete) Strategy Lab strategies by name.
 *
 * Usage:
 *   node apps/api/scripts/deactivate-strategy-lab-strategies.cjs
 *
 * Notes:
 * - Uses isActive=false (safe; reversible)
 * - Keep the list conservative; you can re-run anytime.
 */
require("dotenv/config");

const { PrismaClient } = require("@eve/prisma");
const { PrismaPg } = require("@prisma/adapter-pg");

const NAMES_TO_DEACTIVATE = [
  // Older baseline (kept in DB but removed from sweeps)
  "SL-01 Conservative / High Margin / Low Inventory",

  // Dominated variants from recent sweeps
  "SL-01V D / Inventory 3 days",
  "SL-01V A / Margin 11% (slightly looser)",
  "SL-01V H / Per-item cap 0.12 (slightly more concentrated)",
  "SL-01V J / Package ROI 9% (tighter)",
  "SL-01V B / Margin 13% (tighter)",
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Set it in your environment (or apps/api/.env) before running this script.",
    );
  }
  const adapter = new PrismaPg({ connectionString: url });
  const prisma = new PrismaClient({ adapter });

  try {
    const before = await prisma.tradeStrategy.findMany({
      where: { name: { in: NAMES_TO_DEACTIVATE } },
      select: { id: true, name: true, isActive: true },
    });
    const found = new Set(before.map((x) => x.name));
    const missing = NAMES_TO_DEACTIVATE.filter((n) => !found.has(n));
    if (missing.length) {
      console.log(`[warn] Not found (skipped):\n- ${missing.join("\n- ")}`);
    }

    const res = await prisma.tradeStrategy.updateMany({
      where: { name: { in: NAMES_TO_DEACTIVATE } },
      data: { isActive: false },
    });

    console.log(`[ok] Deactivated strategies: ${res.count}`);

    const after = await prisma.tradeStrategy.findMany({
      where: { name: { in: NAMES_TO_DEACTIVATE } },
      select: { name: true, isActive: true },
      orderBy: { name: "asc" },
    });
    for (const r of after) {
      console.log(`[state] ${r.name} isActive=${r.isActive}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

