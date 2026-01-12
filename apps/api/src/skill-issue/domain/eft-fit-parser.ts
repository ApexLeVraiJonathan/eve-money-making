export type EftFitParseIssue = {
  line: number;
  raw: string;
  error: string;
};

export type ParsedEftFit = {
  shipName: string | null;
  extractedTypeNames: string[];
  issues: EftFitParseIssue[];
};

const SECTION_HEADERS = new Set(
  ['drones', 'cargo', 'implants', 'boosters', 'fighters', 'charges'].map((s) =>
    s.toLowerCase(),
  ),
);

function stripCountSuffix(nameOrLine: string): string {
  // Typical EFT format:
  // - "Hobgoblin II x5"
  // - "Nanite Repair Paste x100"
  const m = nameOrLine.match(/^(.*?)[\t\s]+x(\d+)\s*$/iu);
  if (!m) return nameOrLine.trim();
  return (m[1] ?? '').trim();
}

/**
 * Parse EFT fitting text and extract a ship name and best-effort list of type names.
 *
 * MVP-A notes:
 * - We intentionally treat this as a permissive parser.
 * - We do not try to validate slot counts, rigs, states, etc.
 * - We aim to extract names that can be resolved against `TypeId.name`.
 */
export function parseEftFit(text: string): ParsedEftFit {
  const issues: EftFitParseIssue[] = [];
  const extracted: string[] = [];

  const lines = text.split(/\r?\n/u);

  // Find first non-empty line and parse the [Ship, Fit Name] header.
  let headerLineIndex = -1;
  let shipName: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? '';
    const trimmed = raw.trim();
    if (!trimmed) continue;
    headerLineIndex = i;
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const inner = trimmed.slice(1, -1);
      const firstComma = inner.indexOf(',');
      shipName =
        firstComma >= 0 ? inner.slice(0, firstComma).trim() : inner.trim();
      if (shipName) extracted.push(shipName);
    } else {
      issues.push({
        line: i + 1,
        raw,
        error: 'Expected EFT header line like "[Ship, Fit Name]"',
      });
    }
    break;
  }

  if (headerLineIndex < 0) {
    return {
      shipName: null,
      extractedTypeNames: [],
      issues: [
        {
          line: 0,
          raw: '',
          error: 'Empty EFT text',
        },
      ],
    };
  }

  // Parse all subsequent lines.
  for (let i = headerLineIndex + 1; i < lines.length; i++) {
    const raw = lines[i] ?? '';
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const headerKey = trimmed.toLowerCase();
    if (SECTION_HEADERS.has(headerKey)) {
      continue;
    }

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      // Some tools include bracket lines beyond the header; skip them.
      issues.push({
        line: i + 1,
        raw,
        error: 'Unexpected bracket line; ignoring',
      });
      continue;
    }

    // Handle comma-separated "module, charge"
    const commaIdx = trimmed.indexOf(',');
    if (commaIdx >= 0) {
      const left = trimmed.slice(0, commaIdx).trim();
      const right = trimmed.slice(commaIdx + 1).trim();
      const moduleName = stripCountSuffix(left);
      const chargeName = stripCountSuffix(right);
      if (moduleName) extracted.push(moduleName);
      if (chargeName) extracted.push(chargeName);
      continue;
    }

    const name = stripCountSuffix(trimmed);
    if (name) extracted.push(name);
  }

  // Preserve order but de-dupe.
  const seen = new Set<string>();
  const unique = extracted.filter((n) => {
    const key = n.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { shipName, extractedTypeNames: unique, issues };
}
