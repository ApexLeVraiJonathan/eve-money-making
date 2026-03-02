const STATION_ORDER = ["Dodixie", "Hek", "Rens", "Amarr"] as const;

type StationLike = { station?: { name?: string | null } | null };
type StationNameLike = { stationName?: string | null };

export function sortByStationPriority<T extends StationLike>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aName = a.station?.name ?? "";
    const bName = b.station?.name ?? "";
    const aIndex = STATION_ORDER.findIndex((station) => aName.includes(station));
    const bIndex = STATION_ORDER.findIndex((station) => bName.includes(station));
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return aName.localeCompare(bName);
  });
}

export function sortByStationName<T extends StationNameLike>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aName = a.stationName ?? "";
    const bName = b.stationName ?? "";
    const aIndex = STATION_ORDER.findIndex((station) => aName.includes(station));
    const bIndex = STATION_ORDER.findIndex((station) => bName.includes(station));
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return aName.localeCompare(bName);
  });
}

// Backward-compatible aliases for route-local usage names.
export const sortTrackedStationsByPriority = sortByStationPriority;
export const sortDestinationRows = sortByStationName;
