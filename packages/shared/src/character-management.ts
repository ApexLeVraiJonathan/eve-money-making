export type CharacterOverview = {
  id: number;
  name: string;
  ownerHash: string;
  role: string;
  function: string | null;
  location: string | null;
  managedBy: string;
  isPrimary: boolean;
  tokenStatus: "missing" | "valid" | "expired";
  tokenExpiresAt: string | null;
  walletBalanceIsk: number | null;
  securityStatus: number | null;
  corporationId: number | null;
  allianceId: number | null;
  corporationName: string | null;
  allianceName: string | null;
  skillPoints?: number;
};

export type CharacterOverviewResponse = {
  characters: CharacterOverview[];
};

export type AccountCharacterSummary = {
  id: number;
  name: string;
  role: string;
  function: string | null;
  location: string | null;
  managedBy: string;
  tokenStatus: "missing" | "valid" | "expired";
  tokenExpiresAt: string | null;
};

export type AccountPlexSummary = {
  subscriptionId: string;
  type: "PLEX";
  startsAt: string | null;
  expiresAt: string;
  renewalCycleDays: number | null;
  expectedCostIsk: string | null;
  isActive: boolean;
  status: "none" | "active" | "expired" | "upcoming";
  daysRemaining: number | null;
};

export type EveAccountSummary = {
  id: string;
  label: string | null;
  notes: string | null;
  plex: AccountPlexSummary | null;
  characters: AccountCharacterSummary[];
};

export type AccountsResponse = {
  accounts: EveAccountSummary[];
  unassignedCharacters: AccountCharacterSummary[];
};

export type EveAccountPlex = {
  id: string;
  type: "PLEX";
  startsAt: string | null;
  expiresAt: string;
  renewalCycleDays: number | null;
  expectedCostIsk: string | null;
  isActive: boolean;
  notes: string | null;
};

export type CharacterBooster = {
  id: string;
  boosterName: string;
  source: string | null;
  startsAt: string;
  expiresAt: string;
  notes: string | null;
  status: "active" | "expired" | "upcoming";
};

export type EveAccountMct = {
  id: string;
  expiresAt: string;
  notes: string | null;
};

export type CharacterManagementActionResult = {
  ok: true;
};

export type CreateAccountInput = {
  label?: string;
  notes?: string;
};

export type UpdateAccountMetadataInput = {
  accountId: string;
  label?: string;
  notes?: string;
};

export type AssignCharacterToAccountInput = {
  accountId: string;
  characterId: number;
};

export type UnassignCharacterFromAccountInput = {
  accountId: string;
  characterId: number;
};

export type CreatePlexSubscriptionInput = {
  startsAt?: string;
  expiresAt: string;
  renewalCycleDays?: number;
  expectedCostIsk?: string;
  notes?: string;
};

export type UpdatePlexSubscriptionInput = {
  subscriptionId: string;
  startsAt?: string | null;
  expiresAt?: string | null;
  renewalCycleDays?: number | null;
  expectedCostIsk?: string | null;
  isActive?: boolean | null;
  notes?: string | null;
};

export type CreateMctInput = {
  expiresAt: string;
  notes?: string;
};

export type UpdateMctInput = {
  slotId: string;
  expiresAt?: string;
  notes?: string | null;
};

export type CreateBoosterInput = {
  boosterName: string;
  startsAt?: string;
  expiresAt: string;
  source?: string;
  notes?: string;
};

export type UpdateBoosterInput = {
  boosterId: string;
  boosterName?: string | null;
  startsAt?: string | null;
  expiresAt?: string | null;
  source?: string | null;
  notes?: string | null;
};
