export type UserRole = "USER" | "ADMIN";

export type CurrentUserResponse = {
  userId: string | null;
  role: string;
  characterId: number;
  characterName: string;
};

export type UserFeaturesResponse = {
  enabledFeatures: string[];
};

export type MyCharacterSummary = {
  id: number;
  name: string;
  isPrimary: boolean;
};

export type AdminUserListItem = {
  id: string;
  role: UserRole;
  email: string | null;
  primaryCharacterId: number | null;
  characters: Array<{ id: number; name: string }>;
};

export type TradecraftUserAdminRow = {
  id: string;
  email: string | null;
  role: string;
  primaryCharacter: { id: number; name: string } | null;
  participationCount: number;
  lastParticipationAt: string | null;
  tradecraftPrincipalCapIsk: string | null;
  tradecraftMaximumCapIsk: string | null;
  createdAt: string;
};

export type PrimaryUserSearchRow = {
  id: string;
  email: string | null;
  role: UserRole;
  primaryCharacter: { id: number; name: string };
};

export type UpdateTradecraftUserCapsInput = {
  userId: string;
  principalCapIsk: string | null;
  maximumCapIsk: string | null;
};

export type UpdateTradecraftUserCapsResponse = {
  id: string;
  tradecraftPrincipalCapIsk: string | null;
  tradecraftMaximumCapIsk: string | null;
};

export type AdminCharacterRow = {
  characterId: number;
  characterName: string;
  ownerHash: string;
  userId: string | null;
  accessTokenExpiresAt: string | null;
  scopes: string | null;
  role?: string;
  function?: string | null;
  location?: string | null;
  managedBy?: string;
  notes?: string | null;
};

export type UpdateCharacterProfileInput = {
  characterId: number;
  role?: string;
  function?: string;
  location?: string;
  notes?: string;
};

export type SetUserRoleInput = {
  userId: string;
  role: UserRole;
};

export type AdminUserCharacterLinkInput = {
  userId: string;
  characterId: number;
};

export type SystemCharacterLinkUrlResponse = { url: string };

export type { EveCharacter } from "./types/auth";
