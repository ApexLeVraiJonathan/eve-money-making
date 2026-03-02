export function humanizeStatus(status: string): string {
  const statusMap: Record<string, string> = {
    ACTIVE: "Active",
    COMPLETED_CONTINUING: "Completed (Continuing)",
    COMPLETED_CLOSED_LOSS: "Completed (Closed)",
  };
  return statusMap[status] || status;
}
