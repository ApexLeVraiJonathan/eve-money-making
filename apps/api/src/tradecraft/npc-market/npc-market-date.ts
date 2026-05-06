export function utcDayStartFromYyyyMmDd(date: string | undefined): Date | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const d = new Date(`${date}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}
