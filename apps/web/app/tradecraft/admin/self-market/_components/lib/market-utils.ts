export function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function minutesSince(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const diffMs = Date.now() - d.getTime();
  if (!Number.isFinite(diffMs)) return null;
  return Math.max(0, Math.floor(diffMs / (60 * 1000)));
}

export function formatAgeMinutes(mins: number | null): string {
  if (mins === null) return "—";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m ago` : `${h}h ago`;
}

export function formatBigIntString(v: string): string {
  try {
    return new Intl.NumberFormat().format(BigInt(v));
  } catch {
    return v;
  }
}

export function formatDecimalString(v: string): string {
  const [intPart, frac] = v.split(".");
  const intFmt = formatBigIntString(intPart || "0");
  return frac ? `${intFmt}.${frac}` : intFmt;
}

export function formatIso(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toISOString().replace("T", " ").replace("Z", "Z");
}

export function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

export function computeExpiresAt(order: { issued: string; duration: number }): string {
  const issued = new Date(order.issued);
  if (Number.isNaN(issued.getTime())) return "—";
  const ms = issued.getTime() + order.duration * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}
