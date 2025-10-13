import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    expiresAt?: number;
    characterId?: number;
    characterName?: string;
    ownerHash?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    expires_at?: number;
    characterId?: number;
    characterName?: string;
    ownerHash?: string;
  }
}
