import "dotenv/config";
import { defineConfig } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const storageStatePath = path.join(__dirname, ".playwright", "storageState.json");

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 0,
  use: {
    baseURL: process.env.WEB_URL ?? "http://localhost:3001",
  },
  reporter: [["list"]],

  // Setup-only config: includes the manual ui-setup project.
  projects: [
    {
      name: "ui-setup",
      testMatch: /.*tests\/ui\/auth\.setup\.ts/,
      use: {
        baseURL: process.env.WEB_URL ?? "http://localhost:3001",
      },
    },
    {
      name: "ui",
      testMatch: /.*tests\/ui\/.*\.spec\.ts/,
      workers: 1,
      use: {
        baseURL: process.env.WEB_URL ?? "http://localhost:3001",
        storageState: fs.existsSync(storageStatePath) ? storageStatePath : undefined,
      },
    },
  ],
});


