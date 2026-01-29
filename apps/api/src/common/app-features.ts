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
// identity-level access (publicData). Any Tradecraft functionality that needs
// authenticated ESI endpoints (orders, wallets, assets, structure markets)
// must use SYSTEM-managed characters linked via the admin/system SSO flow.
const TRADECRAFT_SCOPES: readonly string[] = ['publicData'];

// Scopes that are considered "important" for token-downgrade protection.
// These are NOT automatically requested for normal users; they exist so we
// never overwrite a wide-scope refresh token with a narrow-scope token during
// a login/link flow.
const IMPORTANT_TRADECRAFT_SYSTEM_SCOPES: readonly string[] = [
  // Undercut checker / capital computations
  'esi-markets.read_character_orders.v1',
  // Wallet import / capital cash computations
  'esi-wallet.read_character_wallet.v1',
  // Capital inventory computations
  'esi-assets.read_assets.v1',
  // Self-market structure market gathering
  'esi-markets.structure_markets.v1',
];

export const APP_FEATURE_SCOPES: Record<AppFeature, readonly string[]> = {
  [AppFeature.CHARACTERS]: CHARACTER_SCOPES,
  [AppFeature.TRADECRAFT]: TRADECRAFT_SCOPES,
};

export const IMPORTANT_ESI_SCOPES: ReadonlySet<string> = new Set<string>([
  ...CHARACTER_SCOPES,
  ...TRADECRAFT_SCOPES,
  ...IMPORTANT_TRADECRAFT_SYSTEM_SCOPES,
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
