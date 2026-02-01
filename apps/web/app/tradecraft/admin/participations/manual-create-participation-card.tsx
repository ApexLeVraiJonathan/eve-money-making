"use client";

import * as React from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eve/ui";
import { toast } from "@eve/ui";
import { Loader2, PlusCircle } from "lucide-react";
import {
  useAdminCreateParticipationForOpenCycle,
  useAdminTradecraftCaps,
  useCycles,
} from "@/app/tradecraft/api";
import { useSearchUsersByPrimaryCharacter } from "@/app/tradecraft/api/characters/admin.hooks";

function iskFromB(b: number) {
  return (b * 1_000_000_000).toFixed(2);
}

function formatB(b: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(b);
}

const EMPTY_VALUE = "__empty__";

export function ManualCreateParticipationCard() {
  const { data: cycles = [] } = useCycles();
  const openCycles = React.useMemo(
    () => cycles.filter((c) => c.status === "OPEN"),
    [cycles],
  );

  const [cycleId, setCycleId] = React.useState<string>("");
  const [userQuery, setUserQuery] = React.useState<string>("");
  const [debouncedUserQuery, setDebouncedUserQuery] =
    React.useState<string>("");
  const usersQuery = useSearchUsersByPrimaryCharacter(debouncedUserQuery, 20);
  const users = React.useMemo(() => usersQuery.data ?? [], [usersQuery.data]);
  const usersLoading = usersQuery.isFetching;

  const [primaryCharacterId, setPrimaryCharacterId] =
    React.useState<string>("");
  const [amountBInput, setAmountBInput] = React.useState<string>("1");
  const [markPaid, setMarkPaid] = React.useState<boolean>(true);

  // Default to first OPEN cycle
  React.useEffect(() => {
    if (cycleId) return;
    if (openCycles.length === 0) return;
    setCycleId(openCycles[0].id);
  }, [cycleId, openCycles]);

  // Debounce primary search so we don't hammer the API as you type.
  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedUserQuery(userQuery);
    }, 250);
    return () => clearTimeout(t);
  }, [userQuery]);

  // If the query changes, clear the selection (prevents selecting stale results).
  React.useEffect(() => {
    setPrimaryCharacterId("");
  }, [debouncedUserQuery]);

  const selectedUser = React.useMemo(() => {
    const pcid = Number(primaryCharacterId);
    if (!Number.isFinite(pcid) || pcid <= 0) return null;
    return users.find((u) => u.primaryCharacter?.id === pcid) ?? null;
  }, [primaryCharacterId, users]);

  const capsQuery = useAdminTradecraftCaps(selectedUser?.id);
  const caps = capsQuery.data ?? null;

  const createParticipation = useAdminCreateParticipationForOpenCycle();

  const parsedAmountB = React.useMemo(() => {
    const raw = amountBInput.trim();
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  }, [amountBInput]);

  const amountIsk = parsedAmountB == null ? null : iskFromB(parsedAmountB);

  const canSubmit =
    Boolean(cycleId) &&
    selectedUser?.primaryCharacter?.id != null &&
    amountIsk != null &&
    !createParticipation.isPending;

  const validationError = React.useMemo((): string | null => {
    if (!cycleId) return "Select an OPEN cycle";
    if (!selectedUser?.primaryCharacter?.id) return "Select a main character";
    if (amountIsk == null) return "Enter a positive amount (B ISK)";
    if (!caps) return null; // allow submit; backend will still validate

    const amountB = parsedAmountB ?? 0;
    if (amountB > caps.maximumCapB) {
      return `Amount exceeds maximum cap (${formatB(caps.maximumCapB)}B)`;
    }
    if (amountB > caps.effectivePrincipalCapB) {
      return `Amount exceeds effective principal cap (${formatB(
        caps.effectivePrincipalCapB,
      )}B)`;
    }
    return null;
  }, [amountIsk, caps, cycleId, parsedAmountB, selectedUser]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PlusCircle className="h-5 w-5 text-emerald-600" />
          Manual Participation (OPEN cycle)
        </CardTitle>
        <CardDescription>
          Create a participation for a user who missed the opt-in window. Search
          by main character, enter an amount, and the server will enforce the
          user’s current caps.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {openCycles.length === 0 ? (
          <div className="rounded-lg border p-4 text-sm text-muted-foreground">
            No OPEN cycles found. You can only manually create participations
            for OPEN cycles.
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Open cycle</Label>
                <Select value={cycleId} onValueChange={setCycleId}>
                  <SelectTrigger className="w-full" aria-label="Open cycle">
                    <SelectValue placeholder="Select OPEN cycle…" />
                  </SelectTrigger>
                  <SelectContent>
                    {openCycles.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name ?? c.id.substring(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <div className="flex items-end gap-3">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="userFilter">Main character</Label>
                    <Input
                      id="userFilter"
                      placeholder="Search main character (name or id)…"
                      value={userQuery}
                      onChange={(e) => setUserQuery(e.target.value)}
                    />
                    <div className="text-xs text-muted-foreground">
                      Type at least 2 characters to search.
                    </div>
                  </div>
                  <div className="w-[340px] space-y-1">
                    <Label className="sr-only">Select main character</Label>
                    <Select
                      value={primaryCharacterId}
                      onValueChange={setPrimaryCharacterId}
                      disabled={userQuery.trim().length < 2}
                    >
                      <SelectTrigger
                        className="w-full"
                        aria-label="Select main character"
                      >
                        <SelectValue
                          placeholder={
                            userQuery.trim().length < 2
                              ? "Type to search…"
                              : usersLoading
                                ? "Searching…"
                                : "Select main character…"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {users.length === 0 ? (
                          <SelectItem value={EMPTY_VALUE} disabled>
                            {userQuery.trim().length < 2
                              ? "Enter at least 2 characters to search."
                              : usersLoading
                                ? "Searching…"
                                : "No matches found."}
                          </SelectItem>
                        ) : (
                          users.map((u) => {
                            const pc = u.primaryCharacter;
                            return (
                              <SelectItem key={pc.id} value={String(pc.id)}>
                                {pc.name} (#{pc.id}) — {u.id.substring(0, 8)}
                              </SelectItem>
                            );
                          })
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {selectedUser?.primaryCharacter ? (
                  <div className="text-sm">
                    <span className="font-medium text-foreground">
                      Selected:
                    </span>{" "}
                    <span className="font-medium text-foreground">
                      {selectedUser.primaryCharacter.name}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      (user {selectedUser.id.substring(0, 8)}…)
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="amountB">Amount (B ISK)</Label>
                <Input
                  id="amountB"
                  inputMode="decimal"
                  placeholder="e.g. 5"
                  value={amountBInput}
                  onChange={(e) => setAmountBInput(e.target.value)}
                />
                <div className="text-xs text-muted-foreground">
                  {amountIsk ? (
                    <>
                      Will create{" "}
                      <span className="font-mono text-foreground">
                        {amountIsk}
                      </span>{" "}
                      ISK
                    </>
                  ) : (
                    <>Enter a positive number in billions (e.g. 1, 5, 10).</>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Checkbox
                    id="markPaid"
                    checked={markPaid}
                    onCheckedChange={(v) => setMarkPaid(Boolean(v))}
                  />
                  <Label htmlFor="markPaid" className="text-sm">
                    Mark as confirmed (paid)
                  </Label>
                </div>
                <div className="text-xs text-muted-foreground">
                  If unchecked, the participation is created as awaiting payment
                  and can be confirmed later from the “Manual Payment Matching”
                  section (even without a journal link).
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Current caps</Label>
                <div className="rounded-lg border bg-muted/20 p-3">
                  {selectedUser == null ? (
                    <div className="text-sm text-muted-foreground">
                      Select a main character to load caps.
                    </div>
                  ) : capsQuery.isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading caps…
                    </div>
                  ) : caps ? (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge
                        variant="outline"
                        className="bg-slate-500/10 text-slate-700"
                      >
                        Principal: {formatB(caps.principalCapB)}B
                      </Badge>
                      <Badge
                        variant="outline"
                        className="bg-blue-500/10 text-blue-700"
                      >
                        Effective principal:{" "}
                        {formatB(caps.effectivePrincipalCapB)}B
                      </Badge>
                      <Badge
                        variant="outline"
                        className="bg-emerald-500/10 text-emerald-700"
                      >
                        Maximum: {formatB(caps.maximumCapB)}B
                      </Badge>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Caps unavailable. You can still submit; the server will
                      validate.
                    </div>
                  )}
                </div>

                {validationError ? (
                  <div className="text-sm text-destructive">
                    {validationError}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex items-center justify-end">
              <Button
                className="gap-2"
                disabled={!canSubmit || Boolean(validationError)}
                onClick={async () => {
                  if (!selectedUser?.primaryCharacter?.id) {
                    toast.error("Select a main character");
                    return;
                  }
                  if (!cycleId) {
                    toast.error("Select an OPEN cycle");
                    return;
                  }
                  if (!amountIsk) {
                    toast.error("Enter a valid amount (B ISK)");
                    return;
                  }
                  try {
                    await createParticipation.mutateAsync({
                      cycleId,
                      data: {
                        primaryCharacterId: selectedUser.primaryCharacter.id,
                        amountIsk,
                        markPaid,
                      },
                    });
                    toast.success("Participation created.");
                  } catch (e) {
                    const msg =
                      e instanceof Error
                        ? e.message
                        : "Failed to create participation";
                    toast.error(msg);
                  }
                }}
              >
                {createParticipation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  <>
                    <PlusCircle className="h-4 w-4" />
                    Create participation
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
