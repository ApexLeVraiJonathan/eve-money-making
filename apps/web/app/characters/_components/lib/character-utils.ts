import type { CharacterTrainingQueueSummary } from "@eve/shared/skill-contracts";

export function getCharacterInitials(name: string): string {
  return name
    .split(" ")
    .map((segment) => segment[0])
    .join("")
    .slice(0, 2);
}

export function getTimeRemaining(expiresAt: string): { text: string; days: number } {
  const now = Date.now();
  const expiry = new Date(expiresAt).getTime();
  const diffMs = expiry - now;

  if (diffMs <= 0) {
    return { text: "Expired", days: 0 };
  }

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return { text: `${days}d ${hours}h remaining`, days };
  }
  if (hours > 0) {
    return { text: `${hours}h ${minutes}m remaining`, days };
  }
  return { text: `${minutes}m remaining`, days };
}

export function getExpiryColorClass(days: number): string {
  if (days <= 3) return "text-destructive";
  if (days <= 15) return "text-amber-500 dark:text-amber-400";
  return "text-foreground/80";
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const parts: string[] = [];

  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);

  return parts.join(" ");
}

export function formatWholeNumber(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function getTrainingProgressPercent(
  entry: CharacterTrainingQueueSummary["activeEntry"] | null | undefined,
): number {
  if (!entry) return 0;
  if (entry.startDate && entry.finishDate) {
    const start = new Date(entry.startDate).getTime();
    const end = new Date(entry.finishDate).getTime();
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      const pct = ((Date.now() - start) / (end - start)) * 100;
      return Math.min(100, Math.max(0, pct));
    }
  }
  return 0;
}
