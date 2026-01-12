import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const projectRoot = path.resolve(__dirname, "..");

  const buildDir = path.join(projectRoot, ".next-build");
  const runDir = path.join(projectRoot, ".next-run");

  if (await pathExists(runDir)) {
    return;
  }

  if (!(await pathExists(buildDir))) {
    console.error(
      "No production build found. Run `pnpm run build` before `pnpm run start`.",
    );
    process.exit(1);
  }

  // Prefer a fast rename (moves build into runtime), but fall back to copy if needed.
  try {
    await fs.rename(buildDir, runDir);
    return;
  } catch {
    await fs.cp(buildDir, runDir, { recursive: true });
  }
}

await main();
