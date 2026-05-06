export function formatTimeLeft(end: string | number | Date) {
  const endMs = new Date(end).getTime();
  const nowMs = Date.now();
  const diffMs = Math.max(0, endMs - nowMs);
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

  if (days > 0) {
    return `${days}d ${hours}h left`;
  }

  const mins = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) {
    return `${hours}h ${mins}m left`;
  }

  const secs = Math.floor((diffMs % (60 * 1000)) / 1000);
  return `${mins}m ${secs}s left`;
}
