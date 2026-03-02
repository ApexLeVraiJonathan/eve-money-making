import type {
  CharacterFunction,
  CharacterLocation,
  CharacterManagedBy,
  CharacterRole,
  NotificationChannel,
  NotificationType,
} from "./core-enums";

export interface User {
  id: string;
  email: string | null;
  role: string;
  primaryCharacterId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface DiscordAccount {
  id: string;
  userId: string;
  discordUserId: string;
  username: string;
  discriminator: string | null;
  avatarUrl: string | null;
  linkedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPreference {
  id: string;
  userId: string;
  channel: NotificationChannel;
  notificationType: NotificationType;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EveCharacter {
  id: number;
  name: string;
  ownerHash: string;
  userId: string | null;
  role: CharacterRole;
  function: CharacterFunction | null;
  location: CharacterLocation | null;
  managedBy: CharacterManagedBy;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
