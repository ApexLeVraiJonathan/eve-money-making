"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
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

async function fetchCharacters(): Promise<LinkedCharacter[]> {
  const res = await fetch("/api/auth/characters", { cache: "no-store" });
  const data = (await res.json()) as { characters?: LinkedCharacter[] };
  return data.characters ?? [];
}

export default function CharactersPage() {
  const [items, setItems] = React.useState<LinkedCharacter[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchCharacters();
      setItems(list);
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

  return (
    <div className="container mx-auto max-w-4xl p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Characters</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="members">
            <TabsList>
              <TabsTrigger value="members">Users & Admins</TabsTrigger>
              <TabsTrigger value="profiles">Admin Profiles</TabsTrigger>
            </TabsList>

            <TabsContent value="members" className="pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Button asChild>
                  <a href={loginUserUrl}>Link user character</a>
                </Button>
                <Button asChild variant="outline">
                  <a href={loginAdminUrl}>Link admin character</a>
                </Button>
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
              ) : usersAndAdmins.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No users/admins yet.
                </div>
              ) : (
                <ul className="space-y-2">
                  {usersAndAdmins.map((c) => (
                    <li
                      key={c.characterId}
                      className="flex items-center justify-between gap-4 border rounded p-3"
                    >
                      <div className="text-sm">
                        <div className="font-medium">
                          {c.characterName}{" "}
                          <span className="text-xs text-muted-foreground">
                            #{c.characterId}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Role: {c.role ?? "USER"}
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        onClick={() => void handleUnlink(c.characterId)}
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
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
