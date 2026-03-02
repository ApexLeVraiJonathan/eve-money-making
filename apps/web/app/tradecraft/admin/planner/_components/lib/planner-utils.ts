import type { PackagePlan, PlanResult } from "@eve/shared/tradecraft-arbitrage";

export function formatISK(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "ISK",
    currencyDisplay: "code",
    maximumFractionDigits: 2,
  })
    .format(n)
    .replace("ISK", "ISK");
}

export function parseFormattedNumber(value: string): number {
  return Number(value.replace(/,/g, ""));
}

export function formatNumber(value: number): string {
  return value.toLocaleString();
}

export function groupPackagesByDestination(
  data: PlanResult | null,
): Record<string, PackagePlan[]> {
  if (!data) return {};

  return data.packages.reduce<Record<string, PackagePlan[]>>((acc, pkg) => {
    const key = String(pkg.destinationStationId);
    if (!acc[key]) acc[key] = [];
    acc[key].push(pkg);
    return acc;
  }, {});
}

export function buildCopyTextByPackage(
  data: PlanResult | null,
): Record<string, string> {
  const map: Record<string, string> = {};
  if (!data) return map;

  for (const pkg of data.packages) {
    const key = `${pkg.destinationStationId}-${pkg.packageIndex}`;
    map[key] = pkg.items
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((it) => `${it.name}\t${it.units}`)
      .join("\n");
  }

  return map;
}
