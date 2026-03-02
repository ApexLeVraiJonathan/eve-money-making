export type ProfitCategory = "red" | "yellow" | "normal";

export function getProfitCategory(
  marginPercent: number | undefined,
): ProfitCategory {
  if (marginPercent === undefined) return "normal";
  if (marginPercent <= -10) return "red";
  if (marginPercent < 0) return "yellow";
  return "normal";
}
