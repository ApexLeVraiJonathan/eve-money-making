/**
 * Import Adam4EVE weekly MarketOrdersTrades CSV(s) into market_order_trades_daily.
 *
 * This is meant for DEV backfills where you want more history quickly.
 *
 * Usage examples:
 *   node apps/api/scripts/import-market-trades-weekly.cjs --url "https://static.adam4eve.eu/MarketOrdersTrades/2026/marketOrderTrades_weekly_2025-1.csv"
 *
 * Multiple URLs:
 *   node apps/api/scripts/import-market-trades-weekly.cjs --url "..._2025-1.csv" --url "..._2025-2.csv"
 *
 * Convenience range (builds URLs):
 *   node apps/api/scripts/import-market-trades-weekly.cjs --folder 2026 --year 2025 --weeks 1-10
 *
 * Notes:
 * - Filters to tracked stations plus the configured source station id.
 * - Uses createMany(skipDuplicates) to allow re-runs.
 */

require("dotenv/config");

const axios = require("axios");
const { parse } = require("csv-parse");
const { PrismaClient } = require("@eve/prisma");
const { PrismaPg } = require("@prisma/adapter-pg");

const BASE_URL = "https://static.adam4eve.eu";
const PG_INT_MAX = 2147483647;

function parseArgs(argv) {
  const out = { urls: [], batchSize: 10000, folder: null, year: null, weeks: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--url") out.urls.push(argv[++i]);
    else if (a === "--batchSize") out.batchSize = Number(argv[++i]);
    else if (a === "--folder") out.folder = String(argv[++i]);
    else if (a === "--year") out.year = String(argv[++i]);
    else if (a === "--weeks") out.weeks = String(argv[++i]);
  }
  return out;
}

function parseWeekRange(s) {
  // "1-10" or "1,2,3"
  if (!s) return [];
  if (s.includes("-")) {
    const [a, b] = s.split("-").map((x) => Number(x));
    const out = [];
    for (let w = a; w <= b; w++) out.push(w);
    return out;
  }
  return s.split(",").map((x) => Number(x.trim())).filter((n) => Number.isFinite(n));
}

function getSourceStationIdFromEnv() {
  // Default from app config is 60003760 (Jita 4-4), but allow override
  const v = process.env.DEFAULT_SOURCE_STATION_ID;
  return v ? Number(v) : 60003760;
}

async function getTrackedStationIds(prisma) {
  const tracked = await prisma.trackedStation.findMany({ select: { stationId: true } });
  return tracked.map((t) => t.stationId);
}

async function importOneUrl(prisma, url, trackedSet, batchSize) {
  const res = await axios.get(url, { responseType: "stream" });
  const input = res.data;

  const parser = parse({
    columns: true,
    skip_empty_lines: true,
    trim: true,
    delimiter: ";",
    relax_quotes: true,
  });

  input.pipe(parser);

  let totalRows = 0;
  let skipped = 0;
  let inserted = 0;
  let clamped = 0;
  let buf = [];

  async function flush() {
    if (!buf.length) return;
    const { count } = await prisma.marketOrderTradeDaily.createMany({
      data: buf,
      skipDuplicates: true,
    });
    inserted += count;
    buf = [];
  }

  for await (const row of parser) {
    totalRows++;
    const locationId = Number(row.location_id);
    if (!trackedSet.has(locationId)) {
      skipped++;
      continue;
    }

    const scanDateStr = row.scanDate || row.scan_date;
    if (!scanDateStr) {
      skipped++;
      continue;
    }
    const scanDate = new Date(`${scanDateStr}T00:00:00.000Z`);
    if (Number.isNaN(scanDate.getTime())) {
      skipped++;
      continue;
    }

    const regionId = Number(row.region_id);
    const typeId = Number(row.type_id);
    const isBuyOrder = String(row.is_buy_order) === "1";
    const hasGone = String(row.has_gone) === "1";
    let amount = Number(row.amount);
    let orderNum = Number(row.orderNum);

    if (
      !Number.isInteger(locationId) ||
      !Number.isInteger(regionId) ||
      !Number.isInteger(typeId) ||
      !Number.isInteger(amount) ||
      !Number.isInteger(orderNum)
    ) {
      skipped++;
      continue;
    }

    if (amount > PG_INT_MAX) {
      amount = PG_INT_MAX;
      clamped++;
    }
    if (orderNum > PG_INT_MAX) {
      orderNum = PG_INT_MAX;
      clamped++;
    }

    buf.push({
      scanDate,
      locationId,
      typeId,
      isBuyOrder,
      regionId,
      hasGone,
      amount,
      high: row.high,
      low: row.low,
      avg: row.avg,
      orderNum,
      iskValue: row.iskValue,
    });

    if (buf.length >= batchSize) await flush();
  }

  await flush();
  return { url, totalRows, skipped, inserted, clamped };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL is not set");

  const adapter = new PrismaPg({ connectionString: dbUrl });
  const prisma = new PrismaClient({ adapter });
  try {
    const urls = [...args.urls];

    if (urls.length === 0 && args.folder && args.year && args.weeks) {
      const weeks = parseWeekRange(args.weeks);
      for (const w of weeks) {
        urls.push(
          `${BASE_URL}/MarketOrdersTrades/${args.folder}/marketOrderTrades_weekly_${args.year}-${w}.csv`,
        );
      }
    }

    if (urls.length === 0) {
      throw new Error(
        'Provide --url (one or more) or --folder/--year/--weeks (e.g. --folder 2026 --year 2025 --weeks 1-10)',
      );
    }

    const tracked = await getTrackedStationIds(prisma);
    const trackedSet = new Set(tracked);
    trackedSet.add(getSourceStationIdFromEnv());

    console.log(
      `[info] importing ${urls.length} weekly file(s); trackedStations=${tracked.length}; batchSize=${args.batchSize}`,
    );

    for (const url of urls) {
      const t0 = Date.now();
      const res = await importOneUrl(prisma, url, trackedSet, args.batchSize);
      const ms = Date.now() - t0;
      console.log(
        `[ok] ${url} inserted=${res.inserted} skipped=${res.skipped} clamped=${res.clamped} total=${res.totalRows} (${ms}ms)`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

