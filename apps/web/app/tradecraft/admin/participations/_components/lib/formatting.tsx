import { Badge } from "@eve/ui";
import type { ParticipationWithCycle } from "./types";

export function formatIsk(value: string) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(parseFloat(value));
}

export function formatIskFromNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value);
}

export function getParticipationTypeBadge(p: ParticipationWithCycle) {
  if (p.jingleYieldProgramId) {
    return (
      <Badge variant="outline" className="bg-purple-500/10 text-purple-600">
        JingleYield
      </Badge>
    );
  }
  if (p.rolloverType) {
    const label =
      p.rolloverType === "FULL_PAYOUT"
        ? "Rollover (FULL)"
        : p.rolloverType === "INITIAL_ONLY"
          ? "Rollover (INITIAL)"
          : "Rollover (CUSTOM)";
    return (
      <Badge variant="outline" className="bg-blue-500/10 text-blue-600">
        {label}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-slate-500/10 text-slate-600">
      Standard
    </Badge>
  );
}

export function getParticipationType(p: ParticipationWithCycle) {
  if (p.jingleYieldProgramId) return "JingleYield";
  if (p.rolloverType) return `Rollover (${p.rolloverType})`;
  return "Standard";
}

export function getStatusBadge(status: string) {
  switch (status) {
    case "AWAITING_INVESTMENT":
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600">
          Awaiting Payment
        </Badge>
      );
    case "OPTED_IN":
      return (
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600">
          Confirmed
        </Badge>
      );
    case "AWAITING_PAYOUT":
      return (
        <Badge variant="outline" className="bg-blue-500/10 text-blue-600">
          Payout Ready
        </Badge>
      );
    case "COMPLETED":
      return (
        <Badge variant="outline" className="bg-purple-500/10 text-purple-600">
          Paid Out
        </Badge>
      );
    case "OPTED_OUT":
      return (
        <Badge variant="outline" className="bg-gray-500/10 text-gray-600">
          Cancelled
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
