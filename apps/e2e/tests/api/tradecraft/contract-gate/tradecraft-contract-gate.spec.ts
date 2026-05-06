import { test, expect } from "@playwright/test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.cwd(), "../..");

function repoFile(relativePath: string) {
  return path.join(repoRoot, ...relativePath.split("/"));
}

function read(relativePath: string) {
  return readFileSync(repoFile(relativePath), "utf8");
}

function tsFilesUnder(relativePath: string): string[] {
  const absolute = repoFile(relativePath);
  const entries = readdirSync(absolute);
  return entries.flatMap((entry) => {
    const entryPath = path.join(absolute, entry);
    const repoRelative = path.relative(repoRoot, entryPath);
    if (statSync(entryPath).isDirectory()) {
      return tsFilesUnder(repoRelative);
    }
    return /\.(ts|tsx)$/.test(entryPath) ? [repoRelative] : [];
  });
}

test.describe("Tradecraft API/BFF/shared contract gate", () => {
  test("keeps shared contracts on exported package subpaths", () => {
    const sharedPackage = JSON.parse(
      read("packages/shared/package.json"),
    ) as { exports: Record<string, string> };

    expect(Object.keys(sharedPackage.exports)).toEqual(
      expect.arrayContaining([
        "./tradecraft-cycles",
        "./tradecraft-participations",
        "./tradecraft-market",
        "./tradecraft-arbitrage",
        "./tradecraft-pricing",
        "./tradecraft-data-ops",
        "./tradecraft-ops",
      ]),
    );

    const sourceFiles = [
      ...tsFilesUnder("apps/api/src"),
      ...tsFilesUnder("apps/web/app"),
      ...tsFilesUnder("apps/web/lib"),
      ...tsFilesUnder("packages/api-client/src"),
    ];
    const offenders = sourceFiles.filter((file) => {
      const content = read(file.replaceAll("\\", "/"));
      return /@eve\/shared\/(src|dist)\b|packages\/shared\/src|@eve\/shared\/src/.test(
        content,
      );
    });
    expect(offenders).toEqual([]);
  });

  test("routes browser Tradecraft calls through the Next BFF proxy", () => {
    const apiClient = read("packages/api-client/src/index.ts");
    expect(apiClient).toContain('tradecraft: "/api/tradecraft"');
    expect(apiClient).toContain('characters: "/api/characters"');
    expect(apiClient).toContain('credentials: "include"');

    const apiHook = read("apps/web/app/api-hooks/useApiClient.ts");
    expect(apiHook).toContain('if (activeApp?.id === "arbitrage") return "tradecraft"');

    const tradecraftRoute = read("apps/web/app/api/tradecraft/[...path]/route.ts");
    expect(tradecraftRoute).toContain('from "../../_proxy-forward"');
    expect(tradecraftRoute).toContain("return forwardApiRequest(req, path)");

    const proxy = read("apps/web/app/api/_proxy-forward.ts");
    expect(proxy).toContain("pathParts.join");
    expect(proxy).toContain("getServerApiBaseUrl()");
    expect(proxy).toContain("target.search = req.nextUrl.search");

    const tradecraftHookFiles = tsFilesUnder("apps/web/app/tradecraft");
    const directNestUrlUsers = tradecraftHookFiles.filter((file) => {
      const content = read(file.replaceAll("\\", "/"));
      return /API_URL|API_BASE_URL|NEXT_PUBLIC_API_URL|http:\/\/localhost:3000/.test(
        content,
      );
    });
    expect(directNestUrlUsers).toEqual([]);
  });

  test("keeps Tradecraft hooks, route strings, and query keys aligned", () => {
    const cyclesHooks = read("apps/web/app/tradecraft/api/cycles/cycles.hooks.ts");
    const participationsHooks = read(
      "apps/web/app/tradecraft/api/market/participations.hooks.ts",
    );
    const jingleYieldHooks = read(
      "apps/web/app/tradecraft/api/market/jingle-yield.hooks.ts",
    );
    const queryKeys = read("packages/api-client/src/queryKeys.ts");

    expect(cyclesHooks).toEqual(
      expect.stringContaining("/ledger/cycles/overview"),
    );
    expect(cyclesHooks).toEqual(
      expect.stringContaining("/ledger/cycles/${cycleId}/open"),
    );
    expect(cyclesHooks).toEqual(
      expect.stringContaining("/ledger/cycles/${cycleId}/close"),
    );
    expect(cyclesHooks).toEqual(
      expect.stringContaining("/ledger/entries?${params.toString()}"),
    );
    expect(cyclesHooks).toEqual(
      expect.stringContaining("params.set(\"cycleId\", cycleId)"),
    );
    expect(cyclesHooks).not.toContain("`${query}&cycleId=");

    expect(participationsHooks).toContain("qk.participations.history()");
    expect(participationsHooks).toContain("qk.participations.maxAmount()");
    expect(participationsHooks).toContain("qk.participations.unmatchedDonations()");
    expect(participationsHooks).toContain("qk.participations.autoRolloverSettings()");
    expect(participationsHooks).toContain("qk.participations._root");
    expect(participationsHooks).not.toContain('queryKey: ["myParticipationHistory"]');
    expect(participationsHooks).not.toContain('queryKey: ["maxParticipation"]');

    expect(jingleYieldHooks).toContain("qk.jingleYield.programs()");
    expect(jingleYieldHooks).toContain("qk.jingleYield.byId(id)");
    expect(jingleYieldHooks).toContain("qk.jingleYield.me()");
    expect(jingleYieldHooks).toContain("qk.jingleYield._root");
    expect(jingleYieldHooks).toContain("qk.participations._root");
    expect(jingleYieldHooks).not.toContain('queryKey: ["jingleYield"');

    expect(queryKeys).toContain("history: () =>");
    expect(queryKeys).toContain("maxAmount: () =>");
    expect(queryKeys).toContain("jingleYield: {");
    expect(queryKeys).toContain("programs: () =>");
    expect(queryKeys).toContain("byId: (id: string) =>");
    expect(queryKeys).toContain("me: () =>");
  });
});
