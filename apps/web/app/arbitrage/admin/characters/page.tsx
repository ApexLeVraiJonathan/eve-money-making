"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type LinkedCharacter = {
  characterId: number;
  characterName: string;
  ownerHash: string;
  accessTokenExpiresAt: string | null;
  scopes: string | null;
  role?: string;
  function?: string | null;
  location?: string | null;
};

type AdminUserRow = {
  id: string;
  role: "USER" | "ADMIN";
  primaryCharacterId: number | null;
  characters: Array<{ id: number; name: string }>;
};

async function fetchCharacters(): Promise<LinkedCharacter[]> {
  const res = await fetch("/api/auth/characters", { cache: "no-store" });
  const data = (await res.json()) as { characters?: LinkedCharacter[] };
  return data.characters ?? [];
}

async function fetchAdminUsers(): Promise<AdminUserRow[]> {
  const res = await fetch("/api/admin/users", { cache: "no-store" });
  if (!res.ok) return [];
  return (await res.json()) as AdminUserRow[];
}

export default function CharactersPage() {
  const [items, setItems] = React.useState<LinkedCharacter[]>([]);
  const [users, setUsers] = React.useState<AdminUserRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [forceLinkBusy, setForceLinkBusy] = React.useState(false);
  const [roleBusyId, setRoleBusyId] = React.useState<string | null>(null);
  const [setPrimaryBusyId, setSetPrimaryBusyId] = React.useState<number | null>(
    null,
  );
  const [unlinkBusyId, setUnlinkBusyId] = React.useState<number | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, adminUsers] = await Promise.all([
        fetchCharacters(),
        fetchAdminUsers(),
      ]);
      setItems(list);
      setUsers(adminUsers);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleUnlink = async (id: number) => {
    try {
      const res = await fetch(`/api/auth/characters/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to unlink");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const [newCharId, setNewCharId] = React.useState("");
  const [newFunction, setNewFunction] = React.useState("SELLER");
  const [newLocation, setNewLocation] = React.useState("JITA");
  const [selectedId, setSelectedId] = React.useState<number | null>(null);

  const handleSaveProfile = async () => {
    const id = selectedId ?? Number(newCharId || 0);
    if (!id) return;
    try {
      const res = await fetch(`/api/auth/characters/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          role: "LOGISTICS",
          function: newFunction,
          location: newLocation,
        }),
      });
      if (!res.ok) throw new Error((await res.json())?.error || res.statusText);
      await load();
      setNewCharId("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const [loginUserUrl, setLoginUserUrl] = React.useState<string>("");
  const [loginAdminUrl, setLoginAdminUrl] = React.useState<string>("");
  React.useEffect(() => {
    try {
      const base =
        (process.env.NEXT_PUBLIC_API_BASE_URL as string) ||
        "http://localhost:3000";
      const href = window.location.href;
      setLoginUserUrl(
        `${base}/auth/login/user?returnUrl=${encodeURIComponent(href)}`,
      );
      setLoginAdminUrl(
        `${base}/auth/login/admin?returnUrl=${encodeURIComponent(href)}`,
      );
    } catch {
      // ignore
    }
  }, []);

  const usersAndAdmins = items.filter(
    (c) =>
      (c.role === "USER" || c.role === "ADMIN") && !c.function && !c.location,
  );
  const profiles = items.filter((c) => c.role === "LOGISTICS");

  const [selectedUserId, setSelectedUserId] = React.useState<string>("");
  const [forceLinkCharId, setForceLinkCharId] = React.useState<string>("");

  const adminSetPrimary = async (characterId: number) => {
    if (!selectedUserId) return;
    try {
      setSetPrimaryBusyId(characterId);
      const res = await fetch(
        `/api/admin/users/${selectedUserId}/primary-character`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ characterId }),
        },
      );
      if (!res.ok) throw new Error((await res.json())?.error || res.statusText);
      await load();
      toast.success("Primary character updated");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSetPrimaryBusyId(null);
    }
  };

  const adminUnlink = async (characterId: number) => {
    if (!selectedUserId) return;
    try {
      setUnlinkBusyId(characterId);
      const res = await fetch(
        `/api/admin/users/${selectedUserId}/characters/${characterId}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error((await res.json())?.error || res.statusText);
      await load();
      toast.success("Character unlinked");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setUnlinkBusyId(null);
    }
  };

  const handleRoleChange = async (
    userId: string,
    newRole: "USER" | "ADMIN",
  ) => {
    try {
      setRoleBusyId(userId);
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error((await res.json())?.error || res.statusText);
      await load();
      toast.success(`User role changed to ${newRole}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setRoleBusyId(null);
    }
  };

  const handleForceLink = async () => {
    if (!selectedUserId || !forceLinkCharId) return;
    try {
      setForceLinkBusy(true);
      const res = await fetch(
        `/api/admin/users/${selectedUserId}/link-character`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ characterId: Number(forceLinkCharId) }),
        },
      );
      if (!res.ok) throw new Error((await res.json())?.error || res.statusText);
      setForceLinkCharId("");
      await load();
      toast.success("Character force-linked");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setForceLinkBusy(false);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Characters</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="users">
            <TabsList>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="profiles">Logistics</TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Button asChild>
                  <a href={loginUserUrl}>Link user character</a>
                </Button>
                <div className="flex items-center gap-2">
                  <input
                    className="px-2 py-1 rounded border bg-background text-sm w-48"
                    placeholder="User ID"
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                  />
                  <input
                    className="px-2 py-1 rounded border bg-background text-sm w-36"
                    placeholder="Character ID"
                    value={forceLinkCharId}
                    onChange={(e) => setForceLinkCharId(e.target.value)}
                  />
                  <Button
                    variant="secondary"
                    onClick={() => void handleForceLink()}
                    disabled={
                      !selectedUserId || !forceLinkCharId || forceLinkBusy
                    }
                  >
                    {forceLinkBusy ? "Linking…" : "Force link"}
                  </Button>
                </div>
                <Button
                  variant="outline"
                  onClick={() => void load()}
                  disabled={loading}
                >
                  Refresh
                </Button>
              </div>
              {error && <div className="text-sm text-destructive">{error}</div>}
              {loading ? (
                <div className="text-sm text-muted-foreground">Loading…</div>
              ) : users.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No users yet.
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User ID</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Primary</TableHead>
                        <TableHead>Characters</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="text-xs">{u.id}</TableCell>
                          <TableCell className="text-xs">{u.role}</TableCell>
                          <TableCell className="text-xs">
                            {u.primaryCharacterId ?? "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {(u.characters ?? [])
                              .map((c) => `${c.name} (#${c.id})`)
                              .join(", ") || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex gap-2">
                              <Button
                                size="sm"
                                variant={
                                  u.role === "ADMIN" ? "outline" : "secondary"
                                }
                                onClick={() =>
                                  void handleRoleChange(
                                    u.id,
                                    u.role === "ADMIN" ? "USER" : "ADMIN",
                                  )
                                }
                                disabled={roleBusyId === u.id}
                              >
                                {roleBusyId === u.id
                                  ? "Saving…"
                                  : u.role === "ADMIN"
                                    ? "Demote"
                                    : "Promote"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedUserId(u.id)}
                              >
                                Select
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {selectedUserId && (
                <div className="mt-4 rounded-md border p-3">
                  <div className="text-sm mb-2">
                    Selected user:{" "}
                    <code className="px-1 rounded bg-muted">
                      {selectedUserId}
                    </code>
                  </div>
                  {(() => {
                    const u = users.find((x) => x.id === selectedUserId);
                    if (!u)
                      return (
                        <div className="text-sm text-muted-foreground">
                          User not found.
                        </div>
                      );
                    const list = u.characters ?? [];
                    if (list.length === 0)
                      return (
                        <div className="text-sm text-muted-foreground">
                          No linked characters.
                        </div>
                      );
                    return (
                      <div className="space-y-2 text-sm">
                        {list.map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center justify-between"
                          >
                            <div>
                              {c.name} (#{c.id})
                              {u.primaryCharacterId === c.id ? (
                                <em> • Primary</em>
                              ) : null}
                            </div>
                            <div className="flex gap-2">
                              {u.primaryCharacterId !== c.id && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => void adminSetPrimary(c.id)}
                                  disabled={setPrimaryBusyId === c.id}
                                >
                                  {setPrimaryBusyId === c.id
                                    ? "Setting…"
                                    : "Set primary"}
                                </Button>
                              )}
                              {u.primaryCharacterId !== c.id && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => void adminUnlink(c.id)}
                                  disabled={unlinkBusyId === c.id}
                                >
                                  {unlinkBusyId === c.id
                                    ? "Unlinking…"
                                    : "Unlink"}
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </TabsContent>

            <TabsContent value="profiles" className="pt-4">
              <div className="flex flex-col gap-3 mb-4">
                <div className="flex flex-wrap gap-2 items-center">
                  <Button asChild>
                    <a href={loginAdminUrl}>Link admin character</a>
                  </Button>
                  <Select value={newFunction} onValueChange={setNewFunction}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Function" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SELLER">SELLER</SelectItem>
                      <SelectItem value="BUYER">BUYER</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={newLocation} onValueChange={setNewLocation}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="JITA">JITA</SelectItem>
                      <SelectItem value="DODIXIE">DODIXIE</SelectItem>
                      <SelectItem value="AMARR">AMARR</SelectItem>
                      <SelectItem value="HEK">HEK</SelectItem>
                      <SelectItem value="RENS">RENS</SelectItem>
                      <SelectItem value="CN">CN</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="secondary"
                    onClick={() => void handleSaveProfile()}
                  >
                    Save Profile
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void load()}
                    disabled={loading}
                  >
                    Refresh
                  </Button>
                </div>
              </div>

              {error && <div className="text-sm text-destructive">{error}</div>}
              {loading ? (
                <div className="text-sm text-muted-foreground">Loading…</div>
              ) : profiles.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No logistics characters yet.
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead>Function</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {profiles.map((c) => (
                        <TableRow
                          key={c.characterId}
                          data-state={
                            selectedId === c.characterId
                              ? "selected"
                              : undefined
                          }
                        >
                          <TableCell>
                            <input
                              type="radio"
                              name="selectChar"
                              aria-label="Select character"
                              checked={selectedId === c.characterId}
                              onChange={() => setSelectedId(c.characterId)}
                            />
                          </TableCell>
                          <TableCell>{c.characterName}</TableCell>
                          <TableCell className="tabular-nums">
                            {c.characterId}
                          </TableCell>
                          <TableCell>{c.function ?? "-"}</TableCell>
                          <TableCell>{c.location ?? "-"}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => void handleUnlink(c.characterId)}
                            >
                              Remove
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
