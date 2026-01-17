/**
 * Seed a handful of Strategy Lab presets (CommonJS version; no TS transpilation).
 *
 * Usage:
 *   node apps/api/scripts/seed-strategy-lab.cjs
 *   node apps/api/scripts/seed-strategy-lab.cjs --clear
 *
 * Notes:
 * - Upserts by strategy name (unique).
 * - If --clear is provided, deletes ALL existing Strategy Lab strategies first
 *   (and cascades their runs).
 * - Does NOT automatically execute runs (use the web UI to run backtests).
 */

require("dotenv/config");

const { PrismaClient } = require("@eve/prisma");
const { PrismaPg } = require("@prisma/adapter-pg");

const SHIPPING_COST_BY_STATION = {
  "60004588": 20_000_000,
  "60005686": 15_000_000,
  "60008494": 25_000_000,
  "60011866": 15_000_000,
};

const BASE_PARAMS = {
  shippingCostByStation: SHIPPING_COST_BY_STATION,
  packageCapacityM3: 13_000,
  investmentISK: 50_000_000_000,
  perDestinationMaxBudgetSharePerItem: 0.15,
  maxPackagesHint: 120,
  maxPackageCollateralISK: 4_000_000_000,
  allocation: { mode: "best" },
  liquidityOptions: {
    windowDays: 14,
    minCoverageRatio: 0.6,
    minLiquidityThresholdISK: 1_000_000,
    minWindowTrades: 5,
  },
  arbitrageOptions: {
    // Leave fees undefined to use server defaults, but keep core knobs explicit.
  },
};

function makeStrategies() {
  // "Day 1" neutral starter pack: intentionally diverse, not based on past lab results.
  return [
    {
      name: "SL-START 01 Baseline",
      description:
        "Baseline: typical planner defaults; neutral starting point for lab work.",
      params: {
        ...BASE_PARAMS,
        densityWeight: 1.0,
        shippingMarginMultiplier: 1.1,
        minPackageROIPercent: 5,
        arbitrageOptions: {
          ...BASE_PARAMS.arbitrageOptions,
          maxInventoryDays: 3,
          minMarginPercent: 10,
          maxPriceDeviationMultiple: 2.5,
          minTotalProfitISK: 10_000_000,
        },
      },
    },
    {
      name: "SL-START 02 Conservative",
      description:
        "Conservative: tighter liquidity and pricing filters, higher margin, smaller inventory days.",
      params: {
        ...BASE_PARAMS,
        perDestinationMaxBudgetSharePerItem: 0.1,
        densityWeight: 0.8,
        shippingMarginMultiplier: 1.3,
        minPackageROIPercent: 8,
        arbitrageOptions: {
          ...BASE_PARAMS.arbitrageOptions,
          maxInventoryDays: 2,
          minMarginPercent: 12,
          maxPriceDeviationMultiple: 1.8,
          minTotalProfitISK: 15_000_000,
        },
        liquidityOptions: {
          ...BASE_PARAMS.liquidityOptions,
          minCoverageRatio: 0.7,
          minLiquidityThresholdISK: 3_000_000,
          minWindowTrades: 8,
        },
      },
    },
    {
      name: "SL-START 03 Aggressive",
      description:
        "Aggressive: looser filters and thresholds; explores higher throughput at higher risk.",
      params: {
        ...BASE_PARAMS,
        perDestinationMaxBudgetSharePerItem: 0.2,
        densityWeight: 1.0,
        shippingMarginMultiplier: 1.0,
        minPackageROIPercent: 3,
        arbitrageOptions: {
          ...BASE_PARAMS.arbitrageOptions,
          maxInventoryDays: 5,
          minMarginPercent: 7,
          maxPriceDeviationMultiple: 4,
          minTotalProfitISK: 8_000_000,
        },
        liquidityOptions: {
          ...BASE_PARAMS.liquidityOptions,
          minCoverageRatio: 0.55,
          minLiquidityThresholdISK: 1_000_000,
          minWindowTrades: 5,
        },
      },
    },
    {
      name: "SL-START 04 ROI-Weighted",
      description:
        "Bias toward ROI rather than m3 density; tests whether ISK efficiency dominates.",
      params: {
        ...BASE_PARAMS,
        densityWeight: 0.25,
        shippingMarginMultiplier: 1.2,
        minPackageROIPercent: 7,
        arbitrageOptions: {
          ...BASE_PARAMS.arbitrageOptions,
          maxInventoryDays: 3,
          minMarginPercent: 11,
          maxPriceDeviationMultiple: 2.2,
          minTotalProfitISK: 10_000_000,
        },
      },
    },
    {
      name: "SL-START 05 Density-First",
      description:
        "Bias toward profit per m3 (density) rather than ROI; otherwise baseline.",
      params: {
        ...BASE_PARAMS,
        densityWeight: 1.25,
        shippingMarginMultiplier: 1.1,
        minPackageROIPercent: 5,
        arbitrageOptions: {
          ...BASE_PARAMS.arbitrageOptions,
          maxInventoryDays: 3,
          minMarginPercent: 10,
          maxPriceDeviationMultiple: 2.5,
          minTotalProfitISK: 10_000_000,
        },
      },
    },
    {
      name: "SL-START 06 Inventory 1 Day",
      description:
        "Fast-turnover: cap inventory horizon at 1 day; otherwise baseline.",
      params: {
        ...BASE_PARAMS,
        densityWeight: 1.0,
        shippingMarginMultiplier: 1.1,
        minPackageROIPercent: 5,
        arbitrageOptions: {
          ...BASE_PARAMS.arbitrageOptions,
          maxInventoryDays: 1,
          minMarginPercent: 10,
          maxPriceDeviationMultiple: 2.5,
          minTotalProfitISK: 10_000_000,
        },
      },
    },
    // =========================================================================
    // Branches from SL-START 06 (Inventory 1 Day)
    // =========================================================================
    {
      name: "SL-06V A (Inv1 + ROI-Weighted)",
      description:
        "Branch of SL-START 06: inventory=1 day plus ROI-weighted selection (bias to ROI).",
      params: {
        ...BASE_PARAMS,
        densityWeight: 0.25,
        shippingMarginMultiplier: 1.2,
        minPackageROIPercent: 7,
        arbitrageOptions: {
          ...BASE_PARAMS.arbitrageOptions,
          maxInventoryDays: 1,
          minMarginPercent: 11,
          maxPriceDeviationMultiple: 2.2,
          minTotalProfitISK: 10_000_000,
        },
      },
    },
    {
      name: "SL-06V B (Inv1 + Density-First)",
      description:
        "Branch of SL-START 06: inventory=1 day plus density-first selection (profit per m3).",
      params: {
        ...BASE_PARAMS,
        densityWeight: 1.25,
        shippingMarginMultiplier: 1.1,
        minPackageROIPercent: 5,
        arbitrageOptions: {
          ...BASE_PARAMS.arbitrageOptions,
          maxInventoryDays: 1,
          minMarginPercent: 10,
          maxPriceDeviationMultiple: 2.5,
          minTotalProfitISK: 10_000_000,
        },
      },
    },
    {
      name: "SL-06V C (Inv1 + Strict Spike Filter)",
      description:
        "Branch of SL-START 06: inventory=1 day plus strict price deviation filter (avoid spikes).",
      params: {
        ...BASE_PARAMS,
        densityWeight: 1.0,
        shippingMarginMultiplier: 1.1,
        minPackageROIPercent: 5,
        arbitrageOptions: {
          ...BASE_PARAMS.arbitrageOptions,
          maxInventoryDays: 1,
          minMarginPercent: 10,
          maxPriceDeviationMultiple: 1.6,
          minTotalProfitISK: 10_000_000,
        },
      },
    },
    {
      name: "SL-06V D (Inv1 + Conservative Gates)",
      description:
        "Branch of SL-START 06: inventory=1 day plus conservative liquidity gates + tighter pricing filters.",
      params: {
        ...BASE_PARAMS,
        perDestinationMaxBudgetSharePerItem: 0.1,
        densityWeight: 0.8,
        shippingMarginMultiplier: 1.3,
        minPackageROIPercent: 8,
        liquidityOptions: {
          ...BASE_PARAMS.liquidityOptions,
          minCoverageRatio: 0.7,
          minLiquidityThresholdISK: 3_000_000,
          minWindowTrades: 8,
        },
        arbitrageOptions: {
          ...BASE_PARAMS.arbitrageOptions,
          maxInventoryDays: 1,
          minMarginPercent: 12,
          maxPriceDeviationMultiple: 1.8,
          minTotalProfitISK: 15_000_000,
        },
      },
    },
    {
      name: "SL-06V E (Inv1 + ROI + Strict Spike)",
      description:
        "Branch of SL-START 06: inventory=1 day plus ROI-weighting and strict spike filter.",
      params: {
        ...BASE_PARAMS,
        densityWeight: 0.25,
        shippingMarginMultiplier: 1.2,
        minPackageROIPercent: 7,
        arbitrageOptions: {
          ...BASE_PARAMS.arbitrageOptions,
          maxInventoryDays: 1,
          minMarginPercent: 11,
          maxPriceDeviationMultiple: 1.6,
          minTotalProfitISK: 10_000_000,
        },
      },
    },
    {
      name: "SL-START 07 Inventory 7 Days",
      description:
        "Slow-turnover: cap inventory horizon at 7 days; otherwise baseline.",
      params: {
        ...BASE_PARAMS,
        densityWeight: 1.0,
        shippingMarginMultiplier: 1.1,
        minPackageROIPercent: 5,
        arbitrageOptions: {
          ...BASE_PARAMS.arbitrageOptions,
          maxInventoryDays: 7,
          minMarginPercent: 10,
          maxPriceDeviationMultiple: 2.5,
          minTotalProfitISK: 10_000_000,
        },
      },
    },
    {
      name: "SL-START 08 Strict Spike Filter",
      description:
        "Strict price deviation filter (avoid spikes) while keeping baseline inventory/margin.",
      params: {
        ...BASE_PARAMS,
        densityWeight: 1.0,
        shippingMarginMultiplier: 1.1,
        minPackageROIPercent: 5,
        arbitrageOptions: {
          ...BASE_PARAMS.arbitrageOptions,
          maxInventoryDays: 3,
          minMarginPercent: 10,
          maxPriceDeviationMultiple: 1.6,
          minTotalProfitISK: 10_000_000,
        },
      },
    },
  ];
}

function parseArgs(argv) {
  return { clear: argv.includes("--clear") };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Set it in your environment (or .env) before running this seed script.",
    );
  }

  const adapter = new PrismaPg({ connectionString: url });
  const prisma = new PrismaClient({ adapter });
  try {
    if (args.clear) {
      const res = await prisma.tradeStrategy.deleteMany({});
      console.log(`[clear] deletedStrategies=${res.count}`);
    }

    const strategies = makeStrategies();
    for (const s of strategies) {
      const upserted = await prisma.tradeStrategy.upsert({
        where: { name: s.name },
        create: {
          name: s.name,
          description: s.description,
          params: s.params,
          isActive: true,
        },
        update: {
          description: s.description,
          params: s.params,
          isActive: true,
        },
      });
      console.log(`[ok] ${upserted.name} (${upserted.id})`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

