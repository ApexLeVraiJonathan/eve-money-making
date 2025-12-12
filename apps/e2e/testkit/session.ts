import crypto from "node:crypto";
import type { BrowserContext } from "@playwright/test";
import { requireEnv, envOr } from "./env";

async function deriveKey(secret: string): Promise<Buffer> {
  const salt = "eve-money-making:v1";
  return await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(secret, salt, 32, (err, derived) => {
      if (err) reject(err);
      else resolve(derived as Buffer);
    });
  });
}

/**
 * Encrypts the session cookie payload in the same format as the API's CryptoUtil:
 * base64(iv|tag|ciphertext) using AES-256-GCM and a scrypt-derived key.
 */
export async function encryptSessionCookie(plaintextJson: string) {
  const secret = requireEnv("ENCRYPTION_KEY");
  const key = await deriveKey(secret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintextJson, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export async function setApiSessionCookie(
  context: BrowserContext,
  payload: {
    userId: string | null;
    characterId: number;
    characterName: string;
    role: string;
  },
) {
  const cookieValue = await encryptSessionCookie(JSON.stringify(payload));
  const apiOrigin = envOr("API_URL", "http://localhost:3000");
  const webOrigin = envOr("WEB_URL", "http://localhost:3001");

  // IMPORTANT:
  // On localhost, Playwright/Chromium can behave unexpectedly if you set cookies
  // using `domain`. Using `url` is the most reliable approach.
  //
  // We set the cookie for both API and WEB origins. The cookie is host-based
  // (localhost), so this makes it available to the web app and to API requests
  // made with `credentials: include`.
  await context.addCookies([
    {
      name: "session",
      value: cookieValue,
      url: apiOrigin,
      httpOnly: true,
      sameSite: "Lax",
    },
    {
      name: "session",
      value: cookieValue,
      url: webOrigin,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}


