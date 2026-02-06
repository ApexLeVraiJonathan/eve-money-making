/**
 * EVE-style string sorting (as observed in the client item lists):
 * - Compare one character at a time (lexicographic)
 * - Character class precedence: Symbols < Numbers < Alphabet
 * - Case-insensitive for A-Z
 *
 * This is intentionally NOT "numeric sort" (i.e. "10" sorts before "2" because '1' < '2').
 */
export function eveClientStringCompare(aRaw: string, bRaw: string): number {
  const a = normalizeEveSortInput(aRaw);
  const b = normalizeEveSortInput(bRaw);

  // Compare by Unicode code points to avoid splitting surrogate pairs.
  const aChars = Array.from(a);
  const bChars = Array.from(b);
  const minLen = Math.min(aChars.length, bChars.length);

  for (let i = 0; i < minLen; i += 1) {
    const aCh = aChars[i]!;
    const bCh = bChars[i]!;
    if (aCh === bCh) continue;

    const aRank = charClassRank(aCh);
    const bRank = charClassRank(bCh);
    if (aRank !== bRank) return aRank - bRank;

    // Same class: compare within the class.
    if (aRank === 2) {
      const aLower = toAsciiLower(aCh);
      const bLower = toAsciiLower(bCh);
      if (aLower !== bLower) return aLower < bLower ? -1 : 1;
      // Same letter ignoring case: fall back to raw codepoint for stability.
      return aCh < bCh ? -1 : 1;
    }

    // Symbols or digits: compare raw code points.
    return aCh < bCh ? -1 : 1;
  }

  // All shared characters equal: shorter string first.
  return aChars.length - bChars.length;
}

function normalizeEveSortInput(value: string): string {
  // Preserve punctuation (important for EVE ordering), but normalize NBSP and trim.
  return value.replace(/\u00A0/g, " ").trim();
}

/**
 * 0 = symbols/other, 1 = digits, 2 = ASCII letters.
 */
function charClassRank(ch: string): 0 | 1 | 2 {
  const cp = ch.codePointAt(0);
  if (cp === undefined) return 0;
  // 0-9
  if (cp >= 48 && cp <= 57) return 1;
  // A-Z / a-z
  if ((cp >= 65 && cp <= 90) || (cp >= 97 && cp <= 122)) return 2;
  return 0;
}

function toAsciiLower(ch: string): string {
  const cp = ch.codePointAt(0);
  if (cp === undefined) return ch;
  if (cp >= 65 && cp <= 90) return String.fromCodePoint(cp + 32);
  return ch;
}
