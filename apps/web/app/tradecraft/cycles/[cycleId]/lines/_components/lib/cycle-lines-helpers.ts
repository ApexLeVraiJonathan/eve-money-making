export function getCycleShortId(cycleId: string): string {
  return cycleId.slice(0, 8);
}

export function getProfitToneClass(profit: number): string {
  return profit < 0 ? "text-red-400" : "text-emerald-500";
}
