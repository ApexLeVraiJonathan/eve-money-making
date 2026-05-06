const ACTIVE_PARTICIPATION_STATUSES = new Set([
  "OPTED_IN",
  "AWAITING_INVESTMENT",
  "AWAITING_VALIDATION",
  "AWAITING_PAYOUT",
]);

export function isActiveParticipation(status: string) {
  return ACTIVE_PARTICIPATION_STATUSES.has(status);
}
