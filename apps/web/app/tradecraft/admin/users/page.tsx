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
  Input,
  Label,
} from "@eve/ui";
import { toast } from "sonner";
import { Users } from "lucide-react";
import {
  useTradecraftUsers,
  useUpdateTradecraftUserMaxParticipation,
} from "../../api";

function iskFromB(b: number) {
  return (b * 1_000_000_000).toFixed(2);
}

function bFromIsk(isk: string | null) {
  if (!isk) return null;
  const n = Number(isk);
  if (!Number.isFinite(n)) return null;
  return n / 1_000_000_000;
}

export default function TradecraftUsersAdminPage() {
  const { data: users = [], isLoading } = useTradecraftUsers({
    limit: 500,
    offset: 0,
  });
  const updateMax = useUpdateTradecraftUserMaxParticipation();

  const [query, setQuery] = React.useState("");
  const [draftPrincipalB, setDraftPrincipalB] = React.useState<
    Record<string, string>
  >({});
  const [draftMaximumB, setDraftMaximumB] = React.useState<
    Record<string, string>
  >({});

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const email = (u.email ?? "").toLowerCase();
      const id = u.id.toLowerCase();
      const pc = (u.primaryCharacter?.name ?? "").toLowerCase();
      return email.includes(q) || id.includes(q) || pc.includes(q);
    });
  }, [users, query]);

  const handleSave = async (userId: string) => {
    const principalRaw = (draftPrincipalB[userId] ?? "").trim();
    const maximumRaw = (draftMaximumB[userId] ?? "").trim();

    const principalB = principalRaw.length === 0 ? null : Number(principalRaw);
    const maximumB = maximumRaw.length === 0 ? null : Number(maximumRaw);

    if (
      principalB != null &&
      (!Number.isFinite(principalB) || principalB < 0)
    ) {
      toast.error(
        "Invalid principal cap (B ISK). Use a positive number like 10.",
      );
      return;
    }
    if (maximumB != null && (!Number.isFinite(maximumB) || maximumB < 0)) {
      toast.error(
        "Invalid maximum cap (B ISK). Use a positive number like 20.",
      );
      return;
    }
    if (principalB != null && maximumB != null && principalB > maximumB) {
      toast.error("Principal cap cannot be higher than maximum cap");
      return;
    }

    await updateMax.mutateAsync({
      userId,
      principalCapIsk: principalB == null ? null : iskFromB(principalB),
      maximumCapIsk: maximumB == null ? null : iskFromB(maximumB),
    });

    toast.success("Updated Tradecraft caps");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Users className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Tradecraft Users
          </h1>
          <p className="text-sm text-muted-foreground">
            Users who have used Tradecraft before. Manage per-user max
            participation caps.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search & Manage Caps</CardTitle>
          <CardDescription>
            Caps are specified in{" "}
            <span className="font-medium text-foreground">B ISK</span>. Leave
            blank to clear and use defaults.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="Filter by email, userId, or primary character…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              onClick={() =>
                (window.location.href = "/tradecraft/admin/participations")
              }
            >
              Back to participations
            </Button>
          </div>

          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading users…</div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border p-8 text-center">
              <Users className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-sm font-medium mb-1">
                No Tradecraft users found
              </h3>
              <p className="text-sm text-muted-foreground">
                Once users participate in cycles or enable Tradecraft features,
                they will appear here.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">User</th>
                    <th className="text-left p-3 font-medium">Primary</th>
                    <th className="text-right p-3 font-medium">
                      Participations
                    </th>
                    <th className="text-left p-3 font-medium">Last used</th>
                    <th className="text-left p-3 font-medium">
                      Principal cap (B)
                    </th>
                    <th className="text-left p-3 font-medium">
                      Maximum cap (B)
                    </th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((u) => {
                    const currentPrincipalB = bFromIsk(
                      u.tradecraftPrincipalCapIsk,
                    );
                    const currentMaximumB = bFromIsk(u.tradecraftMaximumCapIsk);
                    const draftP = draftPrincipalB[u.id];
                    const draftM = draftMaximumB[u.id];
                    const displayP =
                      draftP ??
                      (currentPrincipalB != null
                        ? String(currentPrincipalB)
                        : "");
                    const displayM =
                      draftM ??
                      (currentMaximumB != null ? String(currentMaximumB) : "");

                    return (
                      <tr key={u.id} className="hover:bg-muted/40">
                        <td className="p-3">
                          <div className="font-medium">{u.email ?? u.id}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {u.id}
                          </div>
                          {u.role === "ADMIN" ? (
                            <div className="mt-1">
                              <Badge
                                variant="outline"
                                className="bg-amber-500/10 text-amber-600"
                              >
                                Admin
                              </Badge>
                            </div>
                          ) : null}
                        </td>
                        <td className="p-3">
                          {u.primaryCharacter ? (
                            <div>
                              <div className="font-medium">
                                {u.primaryCharacter.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                #{u.primaryCharacter.id}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3 text-right tabular-nums">
                          {u.participationCount}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {u.lastParticipationAt
                            ? new Date(u.lastParticipationAt).toLocaleString()
                            : "—"}
                        </td>
                        <td className="p-3">
                          <Input
                            className="w-32"
                            inputMode="decimal"
                            placeholder={
                              currentPrincipalB != null
                                ? String(currentPrincipalB)
                                : "e.g. 10"
                            }
                            value={displayP}
                            onChange={(e) =>
                              setDraftPrincipalB((prev) => ({
                                ...prev,
                                [u.id]: e.target.value,
                              }))
                            }
                          />
                          <div className="mt-2 flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setDraftPrincipalB((p) => ({
                                  ...p,
                                  [u.id]: "10",
                                }))
                              }
                            >
                              10B
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setDraftPrincipalB((p) => ({
                                  ...p,
                                  [u.id]: "20",
                                }))
                              }
                            >
                              20B
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setDraftPrincipalB((p) => ({
                                  ...p,
                                  [u.id]: "",
                                }))
                              }
                            >
                              Clear
                            </Button>
                          </div>
                        </td>
                        <td className="p-3">
                          <Input
                            className="w-32"
                            inputMode="decimal"
                            placeholder={
                              currentMaximumB != null
                                ? String(currentMaximumB)
                                : "e.g. 20"
                            }
                            value={displayM}
                            onChange={(e) =>
                              setDraftMaximumB((prev) => ({
                                ...prev,
                                [u.id]: e.target.value,
                              }))
                            }
                          />
                          <div className="mt-2 flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setDraftMaximumB((p) => ({
                                  ...p,
                                  [u.id]: "20",
                                }))
                              }
                            >
                              20B
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setDraftMaximumB((p) => ({
                                  ...p,
                                  [u.id]: "1000000",
                                }))
                              }
                              title="Sets a very large maximum cap so interest is almost never forced to pay out"
                            >
                              No max (∞)
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setDraftMaximumB((p) => ({ ...p, [u.id]: "" }))
                              }
                            >
                              Clear
                            </Button>
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            size="sm"
                            className="gap-2"
                            disabled={updateMax.isPending}
                            onClick={() =>
                              handleSave(u.id).catch((e) =>
                                toast.error(
                                  e instanceof Error
                                    ? e.message
                                    : "Failed to update",
                                ),
                              )
                            }
                          >
                            Save
                          </Button>
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
