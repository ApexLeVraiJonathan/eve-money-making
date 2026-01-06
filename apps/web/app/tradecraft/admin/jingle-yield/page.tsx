"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useCycles,
  useCreateJingleYieldParticipation,
  useJingleYieldPrograms,
} from "@/app/tradecraft/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Input,
} from "@eve/ui";
import { DollarSign, Loader2, Percent, Shield, Users } from "lucide-react";
import { formatIsk } from "@/lib/utils";
import { toast } from "@eve/ui";
import {
  useAllUsers,
  useAdminCharacters,
} from "../../api/characters/admin.hooks";

// Utility function to humanize status labels
function humanizeStatus(status: string): string {
  const statusMap: Record<string, string> = {
    ACTIVE: "Active",
    COMPLETED_CONTINUING: "Completed (Continuing)",
    COMPLETED_CLOSED_LOSS: "Completed (Closed)",
  };
  return statusMap[status] || status;
}

export default function JingleYieldAdminPage() {
  const { data: programs = [], isLoading } = useJingleYieldPrograms();
  const { data: users = [] } = useAllUsers();
  const { data: adminCharacters = [] } = useAdminCharacters();
  const { data: cycles = [] } = useCycles();

  const [statusFilter, setStatusFilter] = useState<string | "all">("all");

  // JingleYield creation form state
  const [jyUserId, setJyUserId] = useState<string>("");
  const [jyCycleId, setJyCycleId] = useState<string>("");
  const [jyAdminCharacterId, setJyAdminCharacterId] = useState<number | "">("");
  const [jyCharacterName, setJyCharacterName] = useState<string>("");
  const [jyPrincipalIsk, setJyPrincipalIsk] = useState<string>("2000000000");
  const [jyMinCycles, setJyMinCycles] = useState<number | "">(12);

  const createJingleYield = useCreateJingleYieldParticipation();

  // Form validation state
  const isFormValid =
    jyUserId &&
    jyCycleId &&
    jyCharacterName &&
    jyAdminCharacterId !== "" &&
    jyPrincipalIsk &&
    jyMinCycles !== "";

  const getMissingFieldsCount = () => {
    let count = 0;
    if (!jyUserId) count++;
    if (!jyCycleId) count++;
    if (jyAdminCharacterId === "") count++;
    if (!jyPrincipalIsk) count++;
    if (jyMinCycles === "") count++;
    return count;
  };

  const plannedCycles = useMemo(
    () => cycles.filter((c) => c.status === "PLANNED"),
    [cycles],
  );

  const userLabelMap = useMemo(() => {
    const map = new Map<string, { primaryName: string; label: string }>();
    for (const u of users) {
      const primary =
        u.characters.find((c) => c.id === u.primaryCharacterId) ??
        u.characters[0];
      const primaryName = primary?.name ?? "Unknown character";
      map.set(u.id, {
        primaryName,
        label: `${primaryName}`,
      });
    }
    return map;
  }, [users]);

  // Keep display character name in sync with selected user’s primary character
  useEffect(() => {
    if (!jyUserId) {
      setJyCharacterName("");
      return;
    }
    const info = userLabelMap.get(jyUserId);
    setJyCharacterName(info?.primaryName ?? "");
  }, [jyUserId, userLabelMap]);

  const filtered = useMemo(
    () =>
      programs.filter((p) =>
        statusFilter === "all" ? true : p.status === statusFilter,
      ),
    [programs, statusFilter],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Shield className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            JingleYield Programs
          </h1>
          <p className="text-sm text-muted-foreground">
            Overview of seeded principal programs and their progress.
          </p>
        </div>
      </div>

      {/* Create JingleYield Participation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-600" />
            Create JingleYield Participation
          </CardTitle>
          <CardDescription>
            Seed an admin-funded participation for an eligible user in a planned
            cycle. Principal and minimum cycles can be adjusted per program.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                User <span className="text-destructive">*</span>
              </label>
              <Select value={jyUserId} onValueChange={setJyUserId}>
                <SelectTrigger
                  className={`w-full ${!jyUserId && "border-destructive/50"}`}
                >
                  <SelectValue placeholder="Select user…" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => {
                    const info = userLabelMap.get(u.id);
                    return (
                      <SelectItem key={u.id} value={u.id}>
                        {info?.label ?? u.id.substring(0, 8)} (
                        {u.id.substring(0, 8)})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Planned Cycle <span className="text-destructive">*</span>
              </label>
              <Select value={jyCycleId} onValueChange={setJyCycleId}>
                <SelectTrigger
                  className={`w-full ${!jyCycleId && "border-destructive/50"}`}
                >
                  <SelectValue placeholder="Select planned cycle…" />
                </SelectTrigger>
                <SelectContent>
                  {plannedCycles.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name ?? c.id.substring(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Admin Character <span className="text-destructive">*</span>
              </label>
              <Select
                value={
                  jyAdminCharacterId === "" ? "" : String(jyAdminCharacterId)
                }
                onValueChange={(val) =>
                  setJyAdminCharacterId(val ? Number(val) : "")
                }
              >
                <SelectTrigger
                  className={`w-full ${jyAdminCharacterId === "" && "border-destructive/50"}`}
                >
                  <SelectValue placeholder="Select admin character…" />
                </SelectTrigger>
                <SelectContent>
                  {adminCharacters.map((c) => (
                    <SelectItem
                      key={c.characterId}
                      value={String(c.characterId)}
                    >
                      {c.characterName} ({c.characterId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Display Character Name
              </label>
              <Input
                className="bg-muted/50 cursor-not-allowed"
                placeholder="Auto-populated from selected user"
                value={jyCharacterName}
                readOnly
              />
              <p className="text-xs text-muted-foreground">
                Automatically set based on selected user&apos;s primary
                character.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Seeded Principal (ISK)
              </label>
              <Input
                type="number"
                min={1}
                step={1_000_000}
                value={jyPrincipalIsk}
                onChange={(e) => setJyPrincipalIsk(e.target.value)}
                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <p className="text-xs text-muted-foreground">
                Counts toward the 10B principal cap (user principal + JY
                principal ≤ 10B).
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Min Cycles Before Repay
              </label>
              <Input
                type="number"
                min={1}
                value={jyMinCycles}
                onChange={(e) =>
                  setJyMinCycles(e.target.value ? Number(e.target.value) : "")
                }
                className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <p className="text-xs text-muted-foreground">
                Locked principal can only be repaid after at least this many
                cycles or once accrued interest reaches the principal.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4">
            {!isFormValid && (
              <p className="text-sm text-muted-foreground">
                {getMissingFieldsCount()} required{" "}
                {getMissingFieldsCount() === 1 ? "field" : "fields"} remaining
              </p>
            )}
            <Button
              size="sm"
              className="gap-2 ml-auto"
              disabled={!isFormValid || createJingleYield.isPending}
              onClick={async () => {
                try {
                  await createJingleYield.mutateAsync({
                    userId: jyUserId,
                    cycleId: jyCycleId,
                    adminCharacterId:
                      typeof jyAdminCharacterId === "number"
                        ? jyAdminCharacterId
                        : Number(jyAdminCharacterId),
                    characterName: jyCharacterName,
                    principalIsk: jyPrincipalIsk,
                    minCycles:
                      typeof jyMinCycles === "number" ? jyMinCycles : undefined,
                  });
                  toast.success("JingleYield participation created.");
                  setJyUserId("");
                  setJyCycleId("");
                  setJyAdminCharacterId("");
                  setJyCharacterName("");
                } catch (err) {
                  const msg =
                    err instanceof Error ? err.message : "Failed to create JY";
                  toast.error(msg);
                }
              }}
            >
              {createJingleYield.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <DollarSign className="h-3.5 w-3.5" />
                  Create JingleYield
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <div className="text-sm font-medium flex items-center gap-1.5">
              <Users className="h-4 w-4 text-muted-foreground" />
              Active Programs
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums">
              {programs.filter((p) => p.status === "ACTIVE").length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently running JingleYield participants.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="text-sm font-medium flex items-center gap-1.5">
              <Percent className="h-4 w-4 text-emerald-600" />
              Total Locked Principal
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums text-emerald-600">
              {formatIsk(
                programs
                  .filter((p) => p.status === "ACTIVE")
                  .reduce(
                    (sum, p) => sum + parseFloat(p.lockedPrincipalIsk),
                    0,
                  ),
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">ISK locked.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="text-sm font-medium flex items-center gap-1.5">
              <Percent className="h-4 w-4 text-blue-600" />
              Total Interest Earned
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tabular-nums text-blue-600">
              {formatIsk(
                programs.reduce(
                  (sum, p) => sum + parseFloat(p.cumulativeInterestIsk),
                  0,
                ),
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all programs.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle>All JingleYield Programs</CardTitle>
            <CardDescription>
              Track each user’s seeded participation, progress toward 2B
              interest, and completion state.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
            <span className="text-sm font-medium text-foreground">Filter:</span>
            <Select
              value={statusFilter}
              onValueChange={(val) => setStatusFilter(val as string | "all")}
            >
              <SelectTrigger className="w-[200px] h-8 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Programs</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="COMPLETED_CONTINUING">
                  Completed (Continuing)
                </SelectItem>
                <SelectItem value="COMPLETED_CLOSED_LOSS">
                  Completed (Closed)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed p-12 text-center">
              <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                  <Users className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">
                  No programs found
                </h3>
                <p className="mb-4 mt-2 text-sm text-muted-foreground">
                  {statusFilter === "all"
                    ? "No JingleYield programs have been created yet."
                    : `No programs match the "${humanizeStatus(statusFilter)}" filter. Try selecting a different status.`}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">User</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-right p-3 font-medium hidden md:table-cell">
                      Locked
                    </th>
                    <th className="text-right p-3 font-medium">Interest</th>
                    <th className="text-right p-3 font-medium hidden sm:table-cell">
                      Progress
                    </th>
                    <th className="text-left p-3 font-medium hidden lg:table-cell">
                      Cycles
                    </th>
                    <th className="text-left p-3 font-medium hidden xl:table-cell">
                      Start Cycle
                    </th>
                    <th className="text-left p-3 font-medium hidden lg:table-cell">
                      Completed
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((p) => {
                    const interest = parseFloat(p.cumulativeInterestIsk);
                    const target = parseFloat(p.targetInterestIsk) || 1;
                    const pct = Math.min(
                      100,
                      Math.max(0, (interest / target) * 100),
                    );
                    const userInfo = userLabelMap.get(p.userId);

                    return (
                      <tr key={p.id} className="hover:bg-muted/50">
                        <td className="p-3 text-sm">
                          <div className="font-medium">
                            {userInfo?.primaryName ?? p.userId.substring(0, 8)}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {p.userId.substring(0, 8)}…
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge
                            variant="outline"
                            className={
                              p.status === "ACTIVE"
                                ? "bg-emerald-500/10 text-emerald-600"
                                : p.status === "COMPLETED_CONTINUING"
                                  ? "bg-blue-500/10 text-blue-600"
                                  : "bg-red-500/10 text-red-600"
                            }
                          >
                            {humanizeStatus(p.status)}
                          </Badge>
                        </td>
                        <td className="p-3 text-right font-mono text-xs hidden md:table-cell">
                          {formatIsk(parseFloat(p.lockedPrincipalIsk))}
                        </td>
                        <td className="p-3 text-right font-mono text-xs">
                          {formatIsk(interest)}
                        </td>
                        <td className="p-3 text-right text-xs hidden sm:table-cell">
                          {pct.toFixed(1)}%
                        </td>
                        <td className="p-3 text-xs text-muted-foreground hidden lg:table-cell">
                          {p.cyclesCompleted} / {p.minCycles}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground hidden xl:table-cell">
                          {p.startCycle
                            ? `${
                                p.startCycle.name ??
                                p.startCycle.id.substring(0, 8)
                              }`
                            : "—"}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground hidden lg:table-cell">
                          {p.completedCycle
                            ? p.completedCycle.closedAt
                              ? new Date(
                                  p.completedCycle.closedAt,
                                ).toLocaleDateString()
                              : "In progress"
                            : "Not yet"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
