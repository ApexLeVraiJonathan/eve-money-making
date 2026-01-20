export enum AppFeature {
  CHARACTERS = 'CHARACTERS',
  TRADECRAFT = 'TRADECRAFT',
}

// Scopes primarily needed for the Characters app (skills, wallet, assets, etc.)
const CHARACTER_SCOPES: readonly string[] = [
  'publicData',
  'esi-wallet.read_character_wallet.v1',
  'esi-skills.read_skills.v1',
  'esi-skills.read_skillqueue.v1',
  // Required for training pod verification (implants in active clone)
  'esi-clones.read_implants.v1',
  // Required for verifying jump clone implant sets
  'esi-clones.read_clones.v1',
];

// Scopes for Tradecraft when used by USERS. For user flows we only need
// identity-level access (publicData); SYSTEM characters use the
// ESI_SSO_SCOPES_SYSTEM superset configured via environment.
const TRADECRAFT_SCOPES: readonly string[] = ['publicData'];

export const APP_FEATURE_SCOPES: Record<AppFeature, readonly string[]> = {
  [AppFeature.CHARACTERS]: CHARACTER_SCOPES,
  [AppFeature.TRADECRAFT]: TRADECRAFT_SCOPES,
};

export const IMPORTANT_ESI_SCOPES: ReadonlySet<string> = new Set<string>([
  ...CHARACTER_SCOPES,
  ...TRADECRAFT_SCOPES,
]);

export function normalizeScopes(value: string | null | undefined): string[] {
  return (value ?? '')
    .split(' ')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getScopesForFeatures(features: AppFeature[]): string[] {
  const out = new Set<string>();
  for (const f of features) {
    for (const s of APP_FEATURE_SCOPES[f] ?? []) {
      if (s) out.add(s);
    }
  }
  return Array.from(out);
}
