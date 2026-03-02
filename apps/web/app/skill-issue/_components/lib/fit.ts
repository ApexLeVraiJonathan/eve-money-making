export type ParsedEftHeader = { shipName: string; fitName: string };

export function parseEftHeader(eft: string): ParsedEftHeader | null {
  const firstLine =
    eft
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? "";

  const match = firstLine.match(/^\[([^\],]+)\s*,\s*([^\]]+)\]\s*$/);
  if (!match) return null;
  return { shipName: match[1].trim(), fitName: match[2].trim() };
}
