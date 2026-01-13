/**
 * Seed a handful of Strategy Lab presets (CommonJS version; no TS transpilation).
 *
 * Usage:
 *   node apps/api/scripts/seed-strategy-lab.cjs
 *
 * Notes:
 * - Upserts by strategy name (unique).
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
  arbitrageOptions: {},
};

function makeStrategies() {
  return [
    {
      name: "SL-01 Conservative / High Margin / Low Inventory",
      description:
        "Low risk: higher margin threshold, low inventory days, stricter price deviation filter; aims to reduce tail losses.",
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
      name: "SL-02 Balanced / Default-ish",
      description:
        "Baseline: similar to typical planner defaults (3 days inventory, ~10% margin), moderate filters.",
      params: {
        ...BASE_PARAMS,
        perDestinationMaxBudgetSharePerItem: 0.15,
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
      name: "SL-03 Aggressive / Higher Inventory / Lower Margin",
      description:
        "Higher risk: looser margin and larger inventory days; should improve gross returns but may increase drawdowns/losers.",
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
      name: "SL-04 Capital Efficiency / ROI-Weighted",
      description:
        "Treat ISK as the scarce resource: bias toward ROI rather than space/density.",
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
      name: "SL-05 Diversified / Target-Weighted Destinations",
      description:
        "Force diversification between hubs; uses targetWeighted allocation with mild bias.",
      params: {
        ...BASE_PARAMS,
        allocation: {
          mode: "targetWeighted",
          spreadBias: 0.5,
          targets: {
            "60004588": 0.25,
            "60005686": 0.25,
            "60008494": 0.25,
            "60011866": 0.25,
          },
        },
        destinationCaps: {
          "60004588": { maxShare: 0.35 },
          "60005686": { maxShare: 0.35 },
          "60008494": { maxShare: 0.35 },
          "60011866": { maxShare: 0.35 },
        },
        shippingMarginMultiplier: 1.15,
        minPackageROIPercent: 5.5,
        arbitrageOptions: {
          ...BASE_PARAMS.arbitrageOptions,
          maxInventoryDays: 3,
          minMarginPercent: 10,
          maxPriceDeviationMultiple: 2.5,
          minTotalProfitISK: 10_000_000,
        },
      },
    },
  ];
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Set it in your environment (or .env) before running this seed script.",
    );
  }

  const adapter = new PrismaPg({ connectionString: url });
  const prisma = new PrismaClient({ adapter });
  try {
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

