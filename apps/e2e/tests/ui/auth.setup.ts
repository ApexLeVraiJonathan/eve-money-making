import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

test("ui auth setup (manual once)", async ({ page, context }) => {
  // If we already have an authenticated storage state, skip.
  const storageStatePath = path.join(__dirname, "..", "..", ".playwright", "storageState.json");
  if (fs.existsSync(storageStatePath)) {
    try {
      const raw = fs.readFileSync(storageStatePath, "utf8");
      const parsed = JSON.parse(raw) as { cookies?: Array<{ name?: string; value?: string }> };
      const hasSessionCookie =
        Array.isArray(parsed.cookies) &&
        parsed.cookies.some((c) => c?.name === "session" && !!c?.value);

      const sessionCookie = Array.isArray(parsed.cookies)
        ? parsed.cookies.find((c) => c?.name === "session" && !!c?.value)
        : undefined;

      // If the stored session cookie looks URL-encoded (contains '%'), treat it as invalid.
      // Playwright can re-encode it again when restoring, causing double-encoding and 401s.
      const looksEncoded = typeof sessionCookie?.value === "string" && sessionCookie.value.includes("%");

      if (hasSessionCookie && !looksEncoded) {
        test.skip(true, "storageState already exists (has usable session cookie)");
      }
    } catch {
      // Proceed and overwrite after manual login.
    }
  }

  await page.goto("/tradecraft/cycles", { waitUntil: "networkidle" });

  // Pause so you can log in via the UI.
  // After you are logged in (Cycles page no longer shows 'Sign in with EVE'),
  // click 'Resume' in the Playwright inspector.
  await page.pause();

  // If you resumed without actually logging in, refuse to write an empty storageState.
  await expect(page.getByRole("button", { name: "Sign in with EVE" })).toHaveCount(0);

  // Ensure we have the API session cookie that authenticates /ledger/* calls.
  const apiBaseUrl = process.env.API_URL ?? "http://localhost:3000";
  const cookies = await context.cookies([apiBaseUrl, process.env.WEB_URL ?? "http://localhost:3001"]);
  const sessionCookie = cookies.find((c) => c.name === "session" && c.value);
  if (!sessionCookie) {
    throw new Error(
      "After manual login, no `session` cookie was found in the browser context.\n" +
        "This usually means the login did not complete, or the app did not set the API session cookie.\n" +
        "Try logging in again and ensure you are fully authenticated on /tradecraft/cycles before clicking Resume.",
    );
  }

  // Persist state for future headless runs.
  //
  // IMPORTANT:
  // Chromium may store some cookie values URL-encoded (e.g. base64 containing '/'),
  // and Playwright may re-encode them when rehydrating storageState. This can lead
  // to double-encoding and break server-side cookie decryption.
  //
  // We normalize the `session` cookie value for localhost by decoding any
  // percent-encoding before writing storageState.
  const state = await context.storageState();
  state.cookies = (state.cookies ?? []).map((c) => {
    if (c.name === "session" && typeof c.domain === "string" && c.domain.endsWith("localhost")) {
      try {
        return { ...c, value: decodeURIComponent(c.value) };
      } catch {
        return c;
      }
    }
    return c;
  });

  fs.mkdirSync(path.dirname(storageStatePath), { recursive: true });
  fs.writeFileSync(storageStatePath, JSON.stringify(state, null, 2), "utf8");
});


