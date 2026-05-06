import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

type GateStep = {
  id: string;
  label: string;
  command: string[];
  required: boolean;
  note?: string;
};

type GateResult = GateStep & {
  status: "passed" | "failed" | "skipped";
  exitCode: number | null;
  durationMs: number;
};

const repoRoot = path.resolve(__dirname, "../../..");
const reportDir = path.join(repoRoot, "docs", "testing", "runs");

const acceptanceSpecs = [
  "tests/api/tradecraft/acceptance-seed/tradecraft-acceptance-seed.spec.ts",
  "tests/api/tradecraft/cycle-lifecycle/cycle-lifecycle-acceptance.spec.ts",
  "tests/api/tradecraft/participations/participation-acceptance.spec.ts",
  "tests/api/tradecraft/admin-recovery/admin-recovery-acceptance.spec.ts",
  "tests/api/tradecraft/jingle-yield/jingle-yield-acceptance.spec.ts",
  "tests/api/tradecraft/financial-reporting/financial-reporting-acceptance.spec.ts",
  "tests/api/tradecraft/contract-gate/tradecraft-contract-gate.spec.ts",
];

const steps: GateStep[] = [
  {
    id: "type-check",
    label: "Workspace type-check",
    command: ["pnpm", "type-check"],
    required: true,
  },
  {
    id: "lint",
    label: "Workspace lint",
    command: ["pnpm", "lint"],
    required: true,
  },
  {
    id: "build",
    label: "Workspace build",
    command: ["pnpm", "build"],
    required: true,
  },
  {
    id: "unit-tests",
    label: "API and web tests",
    command: ["pnpm", "test:api", "&&", "pnpm", "test:web"],
    required: true,
  },
  {
    id: "seeded-acceptance",
    label: "Canonical seeded Tradecraft API acceptance",
    command: [
      "pnpm",
      "-C",
      "apps/e2e",
      "exec",
      "playwright",
      "test",
      ...acceptanceSpecs,
      "--project",
      "api",
    ],
    required: true,
    note: "Requires the API server to already be running. The tests reset/reseed Tradecraft data.",
  },
];

function formatCommand(command: string[]) {
  return command
    .map((part) => (part.includes(" ") ? `"${part}"` : part))
    .join(" ");
}

function runStep(step: GateStep, dryRun: boolean): GateResult {
  if (dryRun) {
    return {
      ...step,
      status: "skipped",
      exitCode: null,
      durationMs: 0,
    };
  }

  const startedAt = Date.now();
  const result = spawnSync(formatCommand(step.command), {
    cwd: repoRoot,
    stdio: "inherit",
    shell: true,
    env: process.env,
  });

  const exitCode = result.status ?? (result.error ? 1 : 0);
  return {
    ...step,
    status: exitCode === 0 ? "passed" : "failed",
    exitCode,
    durationMs: Date.now() - startedAt,
  };
}

function createReport(results: GateResult[]) {
  mkdirSync(reportDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(reportDir, `tradecraft-acceptance-${timestamp}.md`);

  const requiredFailed = results.some(
    (result) => result.required && result.status === "failed",
  );

  const body = [
    "# Tradecraft Acceptance Gate Run",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Overall technical gate: ${requiredFailed ? "FAILED" : "PASSED"}`,
    "",
    "## Automated Sections",
    "",
    "| Section | Required | Status | Duration | Command |",
    "| --- | --- | --- | --- | --- |",
    ...results.map((result) => {
      const seconds = (result.durationMs / 1000).toFixed(1);
      return `| ${result.label} | ${result.required ? "yes" : "no"} | ${result.status} | ${seconds}s | \`${formatCommand(result.command)}\` |`;
    }),
    "",
    "## Manual Sections",
    "",
    "- [ ] Dirty-data smoke pass completed against realistic local/dev data.",
    "- [ ] Browser smoke completed with no release-blocking UI failures.",
    "- [ ] Performance smoke timings captured for core pages and Cycle Settlement.",
    "- [ ] Domain-owner human signoff completed.",
    "- [ ] Live integration smoke checked separately or consciously deferred.",
    "",
    "## References",
    "",
    "- `docs/prd/pre-main-tradecraft-acceptance-testing.md`",
    "- `docs/testing/pre-main-tradecraft-acceptance.md`",
    "- `docs/testing/tradecraft-local-release-gate.md`",
    "- `docs/testing/tradecraft-browser-smoke-and-signoff.md`",
    "- `docs/issues/README.md`",
    "",
  ].join("\n");

  writeFileSync(reportPath, body, "utf8");
  return reportPath;
}

function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const list = args.has("--list");

  if (list || dryRun) {
    console.log("Tradecraft acceptance gate commands:");
    for (const step of steps) {
      console.log(`- ${step.label}: ${formatCommand(step.command)}`);
      if (step.note) console.log(`  Note: ${step.note}`);
    }
    if (list) return;
  }

  if (dryRun) {
    const reportPath = createReport(steps.map((step) => runStep(step, true)));
    console.log(`Dry-run report written to ${path.relative(repoRoot, reportPath)}`);
    return;
  }

  const results: GateResult[] = [];
  for (const step of steps) {
    console.log(`\n==> ${step.label}`);
    console.log(formatCommand(step.command));
    if (step.note) console.log(step.note);
    const result = runStep(step, false);
    results.push(result);
    if (result.required && result.status === "failed") {
      break;
    }
  }

  const reportPath = createReport(results);
  const failed = results.some(
    (result) => result.required && result.status === "failed",
  );
  console.log(`\nReport written to ${path.relative(repoRoot, reportPath)}`);
  process.exitCode = failed ? 1 : 0;
}

main();
