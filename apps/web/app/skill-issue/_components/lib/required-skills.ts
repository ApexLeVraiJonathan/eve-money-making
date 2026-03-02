export function levelPipColor(status: "met" | "missing" | "unknown") {
  if (status === "met")
    return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
  if (status === "missing")
    return "bg-red-500/15 text-red-300 border-red-500/30";
  return "bg-muted text-foreground/70 border-border";
}
