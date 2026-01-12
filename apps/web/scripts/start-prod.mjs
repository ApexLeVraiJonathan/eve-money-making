import { spawn } from "node:child_process";

// Ensure `.next-run/` exists (initialized from `.next-build/` if needed).
import "./ensure-next-run.mjs";

const port = process.env.PORT ?? "3001";
const nextBin = process.platform === "win32" ? "next.cmd" : "next";

const child = spawn(nextBin, ["start", "-p", port], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
