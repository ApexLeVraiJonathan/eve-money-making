"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  Users,
  Link as LinkIcon,
  RefreshCw,
  Trash2,
  Star,
  UserCog,
  Ship,
} from "lucide-react";

type LinkedCharacter = {
  characterId: number;
  characterName: string;
  ownerHash: string;
  userId: string | null;
  accessTokenExpiresAt: string | null;
  scopes: string | null;
  role?: string;
  function?: string | null;
  location?: string | null;
  managedBy?: string;
  notes?: string | null;
};

type AdminUserRow = {
  id: string;
  role: "USER" | "ADMIN";
  primaryCharacterId: number | null;
  characters: Array<{ id: number; name: string }>;
};

async function fetchCharacters(): Promise<LinkedCharacter[]> {
  const res = await fetch("/api/admin/characters", { cache: "no-store" });
  if (!res.ok) return [];
  return (await res.json()) as LinkedCharacter[];
}

async function fetchAdminUsers(): Promise<AdminUserRow[]> {
  const res = await fetch("/api/admin/users", { cache: "no-store" });
  if (!res.ok) return [];
  return (await res.json()) as AdminUserRow[];
}

async function getSystemCharacterLinkUrl(
  accessToken: string,
  notes?: string,
  returnUrl?: string,
): Promise<string> {
  // Route through Next.js API to avoid relying on public env/base URLs
  const params = new URLSearchParams();
  if (notes) params.set("notes", notes);
  if (returnUrl) params.set("returnUrl", returnUrl);

  const res = await fetch(
    `/api/auth/admin/system-characters/link/url${params.toString() ? `?${params.toString()}` : ""}`,
    {
      // Authorization handled server-side via session in the API route
      cache: "no-store",
    },
  );

  if (!res.ok) {
    throw new Error("Failed to get link URL");
  }

  const data = (await res.json()) as { url: string };
  return data.url;
}

export default function CharactersPageContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
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
  const [systemLinkBusy, setSystemLinkBusy] = React.useState(false);

  // Tab state management with URL sync
  const [activeTab, setActiveTab] = React.useState(
    searchParams.get("tab") || "users",
  );

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.push(`?${params.toString()}`, { scroll: false });
  };

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

  // Show success toast after system character linking
  React.useEffect(() => {
    const linkedChar = searchParams.get("systemCharLinked");
    if (linkedChar) {
      toast.success(`System character "${linkedChar}" linked successfully`);
      // Clean up URL param
      const params = new URLSearchParams(searchParams.toString());
      params.delete("systemCharLinked");
      router.replace(`?${params.toString()}`, { scroll: false });
    }
  }, [searchParams, router]);

  const handleUnlink = async (id: number) => {
    try {
      const res = await fetch(`/api/auth/characters/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to unlink");
      await load();
      toast.success("Character removed");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const [newCharId, setNewCharId] = React.useState("");
  const [newFunction, setNewFunction] = React.useState("SELLER");
  const [newLocation, setNewLocation] = React.useState("JITA");
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [systemCharNotes, setSystemCharNotes] = React.useState("");

  const handleSaveProfile = async () => {
    const id = selectedId ?? Number(newCharId || 0);
    if (!id) {
      toast.error("Please select a character first");
      return;
    }
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
      toast.success("Profile saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleLinkSystemCharacter = async () => {
    if (!session?.accessToken) {
      toast.error("Not authenticated");
      return;
    }

    try {
      setSystemLinkBusy(true);
      // Build return URL with current tab
      const returnParams = new URLSearchParams();
      returnParams.set("tab", activeTab);
      const returnUrl = `${window.location.origin}${window.location.pathname}?${returnParams.toString()}`;

      const url = await getSystemCharacterLinkUrl(
        session.accessToken,
        systemCharNotes || undefined,
        returnUrl,
      );
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      setSystemLinkBusy(false);
    }
  };

  const [loginUserUrl, setLoginUserUrl] = React.useState<string>("");
  React.useEffect(() => {
    try {
      // Build login URL via Next.js route to avoid hardcoded base
      const params = new URLSearchParams();
      params.set("tab", activeTab);
      const returnUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
      setLoginUserUrl(`/auth/login?returnUrl=${encodeURIComponent(returnUrl)}`);
    } catch {
      // ignore
    }
  }, [activeTab]);

  // Filter system characters (SYSTEM managedBy)
  const profiles = items.filter((c) => c.managedBy === "SYSTEM");

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
    <div className="container mx-auto max-w-7xl p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">
          Character Management
        </h1>
        <p className="text-muted-foreground">
          Manage user characters and system logistics profiles
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="space-y-6"
      >
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            User Characters
          </TabsTrigger>
          <TabsTrigger value="profiles" className="gap-2">
            <Ship className="h-4 w-4" />
            System Characters
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="h-5 w-5" />
                Link User Character
              </CardTitle>
              <CardDescription>
                Link EVE characters to user accounts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-4">
                <Button asChild className="gap-2">
                  <a href={loginUserUrl}>
                    <LinkIcon className="h-4 w-4" />
                    Link via EVE SSO
                  </a>
                </Button>

                <div className="flex-1 min-w-[200px] space-y-2">
                  <Label htmlFor="force-user-id">Force Link (Admin Only)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="force-user-id"
                      placeholder="User ID"
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className="max-w-xs"
                    />
                    <Input
                      placeholder="Character ID"
                      value={forceLinkCharId}
                      onChange={(e) => setForceLinkCharId(e.target.value)}
                      className="max-w-xs"
                    />
                    <Button
                      variant="secondary"
                      onClick={() => void handleForceLink()}
                      disabled={
                        !selectedUserId || !forceLinkCharId || forceLinkBusy
                      }
                    >
                      {forceLinkBusy ? "Linking…" : "Force Link"}
                    </Button>
                  </div>
                </div>

                <Button
                  variant="outline"
                  onClick={() => void load()}
                  disabled={loading}
                  className="gap-2"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Registered Users</CardTitle>
              <CardDescription>
                Manage user roles and linked characters
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              {loading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Loading users...
                </div>
              ) : users.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="mb-4 h-12 w-12 text-muted-foreground/50" />
                  <p className="text-sm font-medium">No users yet</p>
                  <p className="text-sm text-muted-foreground">
                    Link a character to create the first user
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[280px]">User ID</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Primary</TableHead>
                          <TableHead>Characters</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((u) => (
                          <TableRow key={u.id}>
                            <TableCell className="font-mono text-xs">
                              {u.id}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  u.role === "ADMIN" ? "default" : "secondary"
                                }
                              >
                                {u.role}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {u.primaryCharacterId ?? "—"}
                            </TableCell>
                            <TableCell className="max-w-md truncate text-sm">
                              {(u.characters ?? [])
                                .map((c) => `${c.name} (#${c.id})`)
                                .join(", ") || "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="inline-flex gap-2">
                                <Button
                                  size="sm"
                                  variant={
                                    u.role === "ADMIN" ? "outline" : "default"
                                  }
                                  onClick={() =>
                                    void handleRoleChange(
                                      u.id,
                                      u.role === "ADMIN" ? "USER" : "ADMIN",
                                    )
                                  }
                                  disabled={roleBusyId === u.id}
                                  className="gap-1.5"
                                >
                                  <UserCog className="h-3.5 w-3.5" />
                                  {roleBusyId === u.id
                                    ? "Saving…"
                                    : u.role === "ADMIN"
                                      ? "Demote"
                                      : "Promote"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => setSelectedUserId(u.id)}
                                >
                                  Manage
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {selectedUserId && (
                    <Card className="border-primary/20">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">
                              Selected User
                            </CardTitle>
                            <CardDescription className="font-mono text-xs mt-1">
                              {selectedUserId}
                            </CardDescription>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedUserId("")}
                          >
                            Clear
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {(() => {
                          const u = users.find((x) => x.id === selectedUserId);
                          if (!u)
                            return (
                              <p className="text-sm text-muted-foreground">
                                User not found.
                              </p>
                            );
                          const list = u.characters ?? [];
                          if (list.length === 0)
                            return (
                              <p className="text-sm text-muted-foreground">
                                No linked characters.
                              </p>
                            );
                          return (
                            <div className="space-y-3">
                              {list.map((c) => (
                                <div
                                  key={c.id}
                                  className="flex items-center justify-between rounded-lg border p-3"
                                >
                                  <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10">
                                      <AvatarImage
                                        src={`https://image.eveonline.com/Character/${c.id}_128.jpg`}
                                        alt={c.name}
                                      />
                                      <AvatarFallback>
                                        {c.name.charAt(0)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">
                                          {c.name}
                                        </span>
                                        {u.primaryCharacterId === c.id && (
                                          <Badge
                                            variant="default"
                                            className="gap-1"
                                          >
                                            <Star className="h-3 w-3" />
                                            Primary
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-xs text-muted-foreground font-mono">
                                        #{c.id}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    {u.primaryCharacterId !== c.id && (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="secondary"
                                          onClick={() =>
                                            void adminSetPrimary(c.id)
                                          }
                                          disabled={setPrimaryBusyId === c.id}
                                          className="gap-1.5"
                                        >
                                          <Star className="h-3.5 w-3.5" />
                                          {setPrimaryBusyId === c.id
                                            ? "Setting…"
                                            : "Set Primary"}
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => void adminUnlink(c.id)}
                                          disabled={unlinkBusyId === c.id}
                                          className="gap-1.5 text-destructive hover:text-destructive"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                          {unlinkBusyId === c.id
                                            ? "Unlinking…"
                                            : "Unlink"}
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Characters Tab */}
        <TabsContent value="profiles" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ship className="h-5 w-5" />
                Link System Character
              </CardTitle>
              <CardDescription>
                Add system-managed characters for logistics operations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[200px] space-y-2">
                  <Label htmlFor="system-char-notes">
                    Character Notes (optional)
                  </Label>
                  <Input
                    id="system-char-notes"
                    placeholder="e.g., Jita hauler, Dodixie seller..."
                    value={systemCharNotes}
                    onChange={(e) => setSystemCharNotes(e.target.value)}
                    className="max-w-md"
                  />
                </div>

                <Button
                  onClick={() => void handleLinkSystemCharacter()}
                  disabled={systemLinkBusy}
                  className="gap-2"
                >
                  <LinkIcon className="h-4 w-4" />
                  {systemLinkBusy ? "Redirecting..." : "Link via EVE SSO"}
                </Button>

                <div className="flex gap-2">
                  <Select value={newFunction} onValueChange={setNewFunction}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SELLER">Seller</SelectItem>
                      <SelectItem value="BUYER">Buyer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={newLocation} onValueChange={setNewLocation}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="JITA">Jita</SelectItem>
                      <SelectItem value="DODIXIE">Dodixie</SelectItem>
                      <SelectItem value="AMARR">Amarr</SelectItem>
                      <SelectItem value="HEK">Hek</SelectItem>
                      <SelectItem value="RENS">Rens</SelectItem>
                      <SelectItem value="CN">CN</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="secondary"
                    onClick={() => void handleSaveProfile()}
                  >
                    Save Profile
                  </Button>
                </div>

                <Button
                  variant="outline"
                  onClick={() => void load()}
                  disabled={loading}
                  className="gap-2"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Characters</CardTitle>
              <CardDescription>
                Logistics characters managed by the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              {loading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Loading characters...
                </div>
              ) : profiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Ship className="mb-4 h-12 w-12 text-muted-foreground/50" />
                  <p className="text-sm font-medium">
                    No logistics characters yet
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Link a system character to get started
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12 text-center">
                          Select
                        </TableHead>
                        <TableHead>Character</TableHead>
                        <TableHead className="text-center">Function</TableHead>
                        <TableHead className="text-center">Location</TableHead>
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
                          className="cursor-pointer"
                          onClick={() =>
                            setSelectedId(
                              selectedId === c.characterId
                                ? null
                                : c.characterId,
                            )
                          }
                        >
                          <TableCell className="py-4 text-center align-middle">
                            <input
                              type="radio"
                              name="selectChar"
                              aria-label="Select character"
                              checked={selectedId === c.characterId}
                              onChange={() =>
                                setSelectedId(
                                  selectedId === c.characterId
                                    ? null
                                    : c.characterId,
                                )
                              }
                              onClick={(e) => e.stopPropagation()}
                              className="h-4 w-4 cursor-pointer"
                            />
                          </TableCell>
                          <TableCell className="py-4 align-middle">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarImage
                                  src={`https://image.eveonline.com/Character/${c.characterId}_128.jpg`}
                                  alt={c.characterName}
                                />
                                <AvatarFallback>
                                  {c.characterName.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">
                                  {c.characterName}
                                </div>
                                <div className="text-xs text-muted-foreground font-mono">
                                  #{c.characterId}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 text-center align-middle">
                            <Badge variant="outline">{c.function ?? "—"}</Badge>
                          </TableCell>
                          <TableCell className="py-4 text-center align-middle">
                            <Badge variant="secondary">
                              {c.location ?? "—"}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-4 text-right align-middle">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleUnlink(c.characterId);
                              }}
                              className="gap-1.5 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Remove
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
