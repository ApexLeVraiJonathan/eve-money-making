export function iskFromB(b: number) {
  return (b * 1_000_000_000).toFixed(2);
}

export function bFromIsk(isk: string | null) {
  if (!isk) return null;
  const n = Number(isk);
  if (!Number.isFinite(n)) return null;
  return n / 1_000_000_000;
}
