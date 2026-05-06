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
import { Users } from "lucide-react";
import { bFromIsk } from "../lib/caps";

type UserRow = {
  id: string;
  email: string | null;
  role: string;
  primaryCharacter: { id: number; name: string } | null;
  participationCount: number;
  lastParticipationAt: string | null;
  tradecraftPrincipalCapIsk: string | null;
  tradecraftMaximumCapIsk: string | null;
};

export function ManageCapsCard({
  query,
  setQuery,
  isLoading,
  filtered,
  draftPrincipalB,
  setDraftPrincipalB,
  draftMaximumB,
  setDraftMaximumB,
  isSaving,
  onSave,
}: {
  query: string;
  setQuery: (value: string) => void;
  isLoading: boolean;
  filtered: UserRow[];
  draftPrincipalB: Record<string, string>;
  setDraftPrincipalB: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  draftMaximumB: Record<string, string>;
  setDraftMaximumB: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  isSaving: boolean;
  onSave: (userId: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Search & Manage Caps</CardTitle>
        <CardDescription>
          Caps are specified in <span className="font-medium text-foreground">B ISK</span>.
          Leave blank to clear and use defaults.
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
            onClick={() => (window.location.href = "/tradecraft/admin/participations")}
          >
            Back to participations
          </Button>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading users…</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border p-8 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-sm font-medium mb-1">No Tradecraft users found</h3>
            <p className="text-sm text-muted-foreground">
              Once users participate in cycles or enable Tradecraft features, they will
              appear here.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">User</th>
                  <th className="text-left p-3 font-medium">Primary</th>
                  <th className="text-right p-3 font-medium">Participations</th>
                  <th className="text-left p-3 font-medium">Last used</th>
                  <th className="text-left p-3 font-medium">Principal cap (B)</th>
                  <th className="text-left p-3 font-medium">Maximum cap (B)</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((u) => {
                  const currentPrincipalB = bFromIsk(u.tradecraftPrincipalCapIsk);
                  const currentMaximumB = bFromIsk(u.tradecraftMaximumCapIsk);
                  const draftP = draftPrincipalB[u.id];
                  const draftM = draftMaximumB[u.id];
                  const displayP =
                    draftP ?? (currentPrincipalB != null ? String(currentPrincipalB) : "");
                  const displayM =
                    draftM ?? (currentMaximumB != null ? String(currentMaximumB) : "");

                  return (
                    <tr key={u.id} className="hover:bg-muted/40">
                      <td className="p-3">
                        <div className="font-medium">{u.email ?? u.id}</div>
                        <div className="text-xs text-muted-foreground font-mono">{u.id}</div>
                        {u.role === "ADMIN" ? (
                          <div className="mt-1">
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600">
                              Admin
                            </Badge>
                          </div>
                        ) : null}
                      </td>
                      <td className="p-3">
                        {u.primaryCharacter ? (
                          <div>
                            <div className="font-medium">{u.primaryCharacter.name}</div>
                            <div className="text-xs text-muted-foreground">#{u.primaryCharacter.id}</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3 text-right tabular-nums">{u.participationCount}</td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {u.lastParticipationAt
                          ? new Date(u.lastParticipationAt).toLocaleString()
                          : "—"}
                      </td>
                      <td className="p-3">
                        <Input
                          className="w-32"
                          inputMode="decimal"
                          placeholder={currentPrincipalB != null ? String(currentPrincipalB) : "e.g. 10"}
                          value={displayP}
                          onChange={(e) =>
                            setDraftPrincipalB((prev) => ({ ...prev, [u.id]: e.target.value }))
                          }
                        />
                        <div className="mt-2 flex gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => setDraftPrincipalB((p) => ({ ...p, [u.id]: "10" }))}>
                            10B
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => setDraftPrincipalB((p) => ({ ...p, [u.id]: "20" }))}>
                            20B
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => setDraftPrincipalB((p) => ({ ...p, [u.id]: "" }))}>
                            Clear
                          </Button>
                        </div>
                      </td>
                      <td className="p-3">
                        <Input
                          className="w-32"
                          inputMode="decimal"
                          placeholder={currentMaximumB != null ? String(currentMaximumB) : "e.g. 20"}
                          value={displayM}
                          onChange={(e) =>
                            setDraftMaximumB((prev) => ({ ...prev, [u.id]: e.target.value }))
                          }
                        />
                        <div className="mt-2 flex gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => setDraftMaximumB((p) => ({ ...p, [u.id]: "20" }))}>
                            20B
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setDraftMaximumB((p) => ({ ...p, [u.id]: "1000000" }))}
                            title="Sets a very large maximum cap so interest is almost never forced to pay out"
                          >
                            No max (∞)
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => setDraftMaximumB((p) => ({ ...p, [u.id]: "" }))}>
                            Clear
                          </Button>
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          size="sm"
                          className="gap-2"
                          disabled={isSaving}
                          onClick={() => onSave(u.id)}
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
  );
}
