/**
 * Seed SL-01 variants (small deltas) so we can run a tight local sweep around the current winner.
 *
 * Usage:
 *   node apps/api/scripts/seed-strategy-lab-sl01-variants.cjs
 *
 * Notes:
 * - Upserts by name (unique)
 * - Generates a focused family of strategies prefixed with "SL-01V"
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

// Baseline = SL-01 from seed-strategy-lab.cjs
const BASE_SL01 = {
  shippingCostByStation: SHIPPING_COST_BY_STATION,
  packageCapacityM3: 13_000,
  investmentISK: 50_000_000_000,
  perDestinationMaxBudgetSharePerItem: 0.1,
  maxPackagesHint: 120,
  maxPackageCollateralISK: 4_000_000_000,
  allocation: { mode: "best" },
  liquidityOptions: {
    windowDays: 14,
    minCoverageRatio: 0.7,
    minLiquidityThresholdISK: 3_000_000,
    minWindowTrades: 8,
  },
  densityWeight: 0.8,
  shippingMarginMultiplier: 1.3,
  minPackageROIPercent: 8,
  arbitrageOptions: {
    maxInventoryDays: 2,
    minMarginPercent: 12,
    maxPriceDeviationMultiple: 1.8,
    minTotalProfitISK: 15_000_000,
  },
};

function makeVariants() {
  const v = [];

  const add = (suffix, description, patch) => {
    v.push({
      name: `SL-01V ${suffix}`,
      description,
      params: patch(JSON.parse(JSON.stringify(BASE_SL01))),
    });
  };

  // Helper: start from the current best-performing combo (K)
  const addK = (suffix, description, patch) => {
    add(`K${suffix}`, description, (p) => {
      // Baseline K behavior
      p.arbitrageOptions.maxInventoryDays = 1;
      p.liquidityOptions.minCoverageRatio = 0.65;
      p.liquidityOptions.minWindowTrades = 6;
      p.liquidityOptions.minLiquidityThresholdISK = 2_000_000;
      return patch(p);
    });
  };

  // Helper: K + margin=11 (K5 baseline)
  const addK5 = (suffix, description, patch) => {
    add(`K5${suffix}`, description, (p) => {
      // Start from K baseline
      p.arbitrageOptions.maxInventoryDays = 1;
      p.liquidityOptions.minCoverageRatio = 0.65;
      p.liquidityOptions.minWindowTrades = 6;
      p.liquidityOptions.minLiquidityThresholdISK = 2_000_000;
      // K5 change
      p.arbitrageOptions.minMarginPercent = 11;
      return patch(p);
    });
  };

  // Margin sensitivity
  add(
    "A / Margin 11% (slightly looser)",
    "SL-01 variant: lower minMarginPercent from 12% to 11% to increase opportunity set; may raise drawdowns.",
    (p) => {
      p.arbitrageOptions.minMarginPercent = 11;
      return p;
    },
  );
  add(
    "B / Margin 13% (tighter)",
    "SL-01 variant: raise minMarginPercent from 12% to 13% to reduce tail losses; may reduce throughput.",
    (p) => {
      p.arbitrageOptions.minMarginPercent = 13;
      return p;
    },
  );

  // Inventory days sensitivity (exposure time)
  add(
    "C / Inventory 1 day",
    "SL-01 variant: reduce maxInventoryDays from 2 to 1 to reduce exposure time; should reduce drawdown and relist pressure.",
    (p) => {
      p.arbitrageOptions.maxInventoryDays = 1;
      return p;
    },
  );
  add(
    "D / Inventory 3 days",
    "SL-01 variant: increase maxInventoryDays from 2 to 3 to allow more volume capture; may increase drawdown.",
    (p) => {
      p.arbitrageOptions.maxInventoryDays = 3;
      return p;
    },
  );

  // Price deviation filter (avoid price spikes)
  add(
    "E / PriceDev 1.6x (tighter)",
    "SL-01 variant: tighten maxPriceDeviationMultiple from 1.8 to 1.6 to avoid chasing spikes; may reduce fills.",
    (p) => {
      p.arbitrageOptions.maxPriceDeviationMultiple = 1.6;
      return p;
    },
  );
  add(
    "F / PriceDev 2.0x (looser)",
    "SL-01 variant: loosen maxPriceDeviationMultiple from 1.8 to 2.0 to allow more trades; may increase tail risk.",
    (p) => {
      p.arbitrageOptions.maxPriceDeviationMultiple = 2.0;
      return p;
    },
  );

  // Per-item concentration cap (diversification)
  add(
    "G / Per-item cap 0.08 (more diversified)",
    "SL-01 variant: reduce perDestinationMaxBudgetSharePerItem from 0.10 to 0.08 to reduce single-item risk.",
    (p) => {
      p.perDestinationMaxBudgetSharePerItem = 0.08;
      return p;
    },
  );
  add(
    "H / Per-item cap 0.12 (slightly more concentrated)",
    "SL-01 variant: increase perDestinationMaxBudgetSharePerItem from 0.10 to 0.12 to concentrate into top edges.",
    (p) => {
      p.perDestinationMaxBudgetSharePerItem = 0.12;
      return p;
    },
  );

  // Liquidity gate sensitivity (coverage/trades)
  add(
    "I / Liquidity gates slightly looser",
    "SL-01 variant: loosen liquidityOptions (coverage/trades/ISK) to increase eligible items; watch for noisy losers.",
    (p) => {
      p.liquidityOptions.minCoverageRatio = 0.65;
      p.liquidityOptions.minWindowTrades = 6;
      p.liquidityOptions.minLiquidityThresholdISK = 2_000_000;
      return p;
    },
  );

  // Combo: low inventory + looser liquidity gates
  add(
    "K / Inventory 1 day + Liquidity gates looser",
    "SL-01 variant: combine maxInventoryDays=1 with looser liquidity gates to test if the edge is complementary.",
    (p) => {
      p.arbitrageOptions.maxInventoryDays = 1;
      p.liquidityOptions.minCoverageRatio = 0.65;
      p.liquidityOptions.minWindowTrades = 6;
      p.liquidityOptions.minLiquidityThresholdISK = 2_000_000;
      return p;
    },
  );

  // Next test batch: sweep other knobs around the winning K baseline
  addK(
    "1 / Per-item cap 0.06 (more diversified)",
    "K-based: reduce perDestinationMaxBudgetSharePerItem to 0.06 to reduce single-item tail risk.",
    (p) => {
      p.perDestinationMaxBudgetSharePerItem = 0.06;
      return p;
    },
  );
  addK(
    "2 / Per-item cap 0.08 (more diversified)",
    "K-based: reduce perDestinationMaxBudgetSharePerItem to 0.08 to reduce concentration while keeping throughput.",
    (p) => {
      p.perDestinationMaxBudgetSharePerItem = 0.08;
      return p;
    },
  );
  addK(
    "3 / PriceDev 1.4x (tighter anti-spike)",
    "K-based: tighten maxPriceDeviationMultiple to 1.4 to avoid chasing spikes (important when liquidity gates are loose).",
    (p) => {
      p.arbitrageOptions.maxPriceDeviationMultiple = 1.4;
      return p;
    },
  );
  addK(
    "4 / PriceDev 1.6x (tighter anti-spike)",
    "K-based: tighten maxPriceDeviationMultiple to 1.6 to reduce noisy losers admitted by loose liquidity gates.",
    (p) => {
      p.arbitrageOptions.maxPriceDeviationMultiple = 1.6;
      return p;
    },
  );
  addK(
    "5 / Margin 11% (slightly looser)",
    "K-based: reduce minMarginPercent to 11% to widen opportunity set while keeping 1-day inventory.",
    (p) => {
      p.arbitrageOptions.minMarginPercent = 11;
      return p;
    },
  );
  addK(
    "6 / Margin 13% (tighter)",
    "K-based: increase minMarginPercent to 13% to improve deal quality; should reduce drawdown at cost of throughput.",
    (p) => {
      p.arbitrageOptions.minMarginPercent = 13;
      return p;
    },
  );
  addK(
    "7 / Allocation targetWeighted (equal hubs)",
    "K-based: force diversification across hubs using targetWeighted allocation and mild destination caps.",
    (p) => {
      p.allocation = {
        mode: "targetWeighted",
        spreadBias: 0.5,
        targets: {
          "60004588": 0.25,
          "60005686": 0.25,
          "60008494": 0.25,
          "60011866": 0.25,
        },
      };
      p.destinationCaps = {
        "60004588": { maxShare: 0.35 },
        "60005686": { maxShare: 0.35 },
        "60008494": { maxShare: 0.35 },
        "60011866": { maxShare: 0.35 },
      };
      return p;
    },
  );
  addK(
    "8 / DensityWeight 0.5 (more ROI-focused)",
    "K-based: reduce densityWeight to 0.5 to bias away from bulky items and toward capital efficiency.",
    (p) => {
      p.densityWeight = 0.5;
      return p;
    },
  );

  // Stacked candidates: combine best knobs on top of K5
  addK5(
    "A / +PriceDev 1.6x",
    "K5 stacked: add tighter maxPriceDeviationMultiple=1.6 to reduce spike-y losers with loose liquidity gates.",
    (p) => {
      p.arbitrageOptions.maxPriceDeviationMultiple = 1.6;
      return p;
    },
  );
  addK5(
    "B / +DensityWeight 0.5",
    "K5 stacked: add densityWeight=0.5 to bias toward capital efficiency while keeping margin=11.",
    (p) => {
      p.densityWeight = 0.5;
      return p;
    },
  );
  addK5(
    "C / +PriceDev 1.6x +DensityWeight 0.5",
    "K5 stacked: combine anti-spike (1.6x) + capital efficiency (densityWeight=0.5).",
    (p) => {
      p.arbitrageOptions.maxPriceDeviationMultiple = 1.6;
      p.densityWeight = 0.5;
      return p;
    },
  );
  addK5(
    "D / +Per-item cap 0.08",
    "K5 stacked: add perDestinationMaxBudgetSharePerItem=0.08 to reduce single-item tail risk.",
    (p) => {
      p.perDestinationMaxBudgetSharePerItem = 0.08;
      return p;
    },
  );

  // Progressively looser liquidity gates (to find the cliff)
  add(
    "L / Liquidity gates looser (0.60 / 5 trades / 1M)",
    "SL-01 variant: looser liquidity gates (coverage 0.60, trades 5, ISK/day 1M) to widen candidate set further.",
    (p) => {
      p.liquidityOptions.minCoverageRatio = 0.6;
      p.liquidityOptions.minWindowTrades = 5;
      p.liquidityOptions.minLiquidityThresholdISK = 1_000_000;
      return p;
    },
  );
  add(
    "M / Liquidity gates very loose (0.55 / 4 trades / 0.75M)",
    "SL-01 variant: very loose liquidity gates (coverage 0.55, trades 4, ISK/day 0.75M). Expect more noisy/fragile items.",
    (p) => {
      p.liquidityOptions.minCoverageRatio = 0.55;
      p.liquidityOptions.minWindowTrades = 4;
      p.liquidityOptions.minLiquidityThresholdISK = 750_000;
      return p;
    },
  );
  add(
    "N / Liquidity gates ultra loose (0.50 / 3 trades / 0.50M)",
    "SL-01 variant: ultra loose liquidity gates (coverage 0.50, trades 3, ISK/day 0.50M) to find the limit/cliff.",
    (p) => {
      p.liquidityOptions.minCoverageRatio = 0.5;
      p.liquidityOptions.minWindowTrades = 3;
      p.liquidityOptions.minLiquidityThresholdISK = 500_000;
      return p;
    },
  );

  // Even looser liquidity gates (push until it breaks)
  add(
    "O / Liquidity gates extreme (0.45 / 2 trades / 0.35M)",
    "SL-01 variant: extreme liquidity gates (coverage 0.45, trades 2, ISK/day 0.35M). This is close to the likely cliff.",
    (p) => {
      p.liquidityOptions.minCoverageRatio = 0.45;
      p.liquidityOptions.minWindowTrades = 2;
      p.liquidityOptions.minLiquidityThresholdISK = 350_000;
      return p;
    },
  );
  add(
    "P / Liquidity gates extreme+ (0.40 / 2 trades / 0.25M)",
    "SL-01 variant: extreme+ liquidity gates (coverage 0.40, trades 2, ISK/day 0.25M). Expect more noise and worse DD.",
    (p) => {
      p.liquidityOptions.minCoverageRatio = 0.4;
      p.liquidityOptions.minWindowTrades = 2;
      p.liquidityOptions.minLiquidityThresholdISK = 250_000;
      return p;
    },
  );
  add(
    "Q / Liquidity gates extreme++ (0.35 / 1 trade / 0.20M)",
    "SL-01 variant: extreme++ liquidity gates (coverage 0.35, trades 1, ISK/day 0.20M). This is expected to be past the cliff.",
    (p) => {
      p.liquidityOptions.minCoverageRatio = 0.35;
      p.liquidityOptions.minWindowTrades = 1;
      p.liquidityOptions.minLiquidityThresholdISK = 200_000;
      return p;
    },
  );

  // ROI requirement
  add(
    "J / Package ROI 9% (tighter)",
    "SL-01 variant: increase minPackageROIPercent from 8 to 9 for stricter deal quality; may reduce throughput.",
    (p) => {
      p.minPackageROIPercent = 9;
      return p;
    },
  );

  return v;
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
    const variants = makeVariants();
    for (const s of variants) {
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

