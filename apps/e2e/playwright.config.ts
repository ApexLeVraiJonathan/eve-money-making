import "dotenv/config";
import { defineConfig } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const storageStatePath = path.join(
  __dirname,
  ".playwright",
  "storageState.json",
);
function hasUsableStorageState(): boolean {
  if (!fs.existsSync(storageStatePath)) return false;
  try {
    const raw = fs.readFileSync(storageStatePath, "utf8");
    const parsed = JSON.parse(raw) as {
      cookies?: Array<{ name?: string; value?: string }>;
    };
    const cookies = Array.isArray(parsed.cookies) ? parsed.cookies : [];
    const session = cookies.find(
      (c) =>
        c?.name === "session" &&
        typeof c?.value === "string" &&
        c.value.length > 0,
    );
    if (!session) return false;
    // If it looks percent-encoded, treat as invalid (can lead to double-encoding on restore).
    if ((session.value ?? "").includes("%")) return false;
    return true;
  } catch {
    return false;
  }
}
const hasStorageState = hasUsableStorageState();

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 0,
  use: {
    baseURL: process.env.WEB_URL ?? "http://localhost:3001",
  },
  reporter: [["list"]],

  projects: [
    {
      name: "api",
      testMatch: /.*tests\/api\/.*\.spec\.ts/,
      // API tests in this repo reset shared DB state. Run serially to avoid
      // cross-test interference when multiple workers would race resets.
      workers: 1,
    },
    {
      name: "ui",
      testMatch: /.*tests\/ui\/.*\.spec\.ts/,
      // UI tests in this repo mutate shared DB state (reset helpers) and reuse an auth storageState.
      // Run them serially to avoid cross-test interference.
      workers: 1,
      use: {
        baseURL: process.env.WEB_URL ?? "http://localhost:3001",
        storageState: hasStorageState ? storageStatePath : undefined,
      },
    },
  ],
});
