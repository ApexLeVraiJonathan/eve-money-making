/**
 * Normalize various header shapes (arrays, numbers, booleans) into strings.
 * Returns a lowercase-keyed record with string or undefined values.
 */
export function normalizeHeaders(
  raw: unknown,
): Record<string, string | undefined> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    let value: string | undefined;
    if (Array.isArray(v)) {
      const parts = v
        .map((x) =>
          typeof x === 'string'
            ? x
            : typeof x === 'number' || typeof x === 'boolean'
              ? String(x)
              : undefined,
        )
        .filter((x): x is string => x !== undefined);
      value = parts.join(',');
    } else if (typeof v === 'string') {
      value = v;
    } else if (typeof v === 'number' || typeof v === 'boolean') {
      value = String(v);
    } else {
      value = undefined;
    }
    out[k.toLowerCase()] = value;
  }
  return out;
}
