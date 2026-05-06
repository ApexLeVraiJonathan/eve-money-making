import type { Cycle } from "@eve/shared/tradecraft-cycles";

export function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function normalizeIsk(raw: string) {
  const n = Number(raw);
  if (!raw || Number.isNaN(n)) return undefined;
  return n.toFixed(2);
}

export function getStatus(c: Cycle): "Planned" | "Ongoing" | "Completed" {
  if (c.status === "PLANNED") return "Planned";
  if (c.status === "COMPLETED") return "Completed";
  return "Ongoing";
}

export function formatLocal(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleString() : "—";
}
