import { type AuthOptions } from "next-auth";
import EVEOnlineProvider from "next-auth/providers/eveonline";

interface EVEProfile {
  CharacterID: number;
  CharacterName: string;
  CharacterOwnerHash: string;
}

export const authOptions: AuthOptions = {
  providers: [
    EVEOnlineProvider({
      clientId: process.env.EVE_CLIENT_ID!,
      clientSecret: process.env.EVE_CLIENT_SECRET!,
      // For Authentication Only apps (App 1), no scope needed
      // Character linking uses separate App 2 via NestJS direct OAuth
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, account, profile }) {
      // On initial sign-in, copy EVE access_token and expiry
      if (account?.access_token) {
        token.accessToken = account.access_token;

        // EVE provides expires_at (absolute unix timestamp in seconds), not expires_in
        const expiresAtSeconds = Number(account.expires_at) || 0;
        const nowSeconds = Math.floor(Date.now() / 1000);
        const expiresInSeconds = Math.max(0, expiresAtSeconds - nowSeconds);

        token.expires_at = expiresAtSeconds * 1000; // Store as milliseconds

        // Call backend to register/link the character (initial login only - App 1)
        try {
          const eveProfile = profile as EVEProfile;
          const characterId = eveProfile?.CharacterID;
          const characterName = eveProfile?.CharacterName;
          const ownerHash = eveProfile?.CharacterOwnerHash;

          if (characterId && characterName && ownerHash) {
            // Call NestJS to store character and tokens
            const apiUrl = process.env.API_URL || "http://localhost:3000";
            await fetch(`${apiUrl}/auth/link-character`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${account.access_token}`,
              },
              body: JSON.stringify({
                characterId,
                characterName,
                ownerHash,
                accessToken: account.access_token,
                refreshToken: account.refresh_token,
                expiresIn: expiresInSeconds, // Send relative seconds to backend
                scopes: account.scope || "",
              }),
            });

            token.characterId = characterId;
            token.characterName = characterName;
            token.ownerHash = ownerHash;
          }
        } catch (error) {
          console.error("Failed to link character to backend:", error);
        }
      }
      return token;
    },
    async session({ session, token }) {
      // Expose EVE access token and character info to session
      session.accessToken = token.accessToken;
      session.expiresAt = token.expires_at;
      session.characterId = token.characterId;
      session.characterName = token.characterName;
      session.ownerHash = token.ownerHash;
      return session;
    },
  },
};
