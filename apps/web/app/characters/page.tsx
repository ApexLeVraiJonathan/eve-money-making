"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type LinkedCharacter = {
  characterId: number;
  characterName: string;
  ownerHash: string;
  accessTokenExpiresAt: string | null;
  scopes: string | null;
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

  const linkUrl = "/auth/login"; // call API directly; local-only app

  return (
    <div className="container mx-auto max-w-3xl p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Linked Characters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Button asChild>
              <a href={linkUrl}>Link a character</a>
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
          ) : items.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No linked characters yet.
            </div>
          ) : (
            <ul className="space-y-2">
              {items.map((c) => {
                const exp = c.accessTokenExpiresAt
                  ? new Date(c.accessTokenExpiresAt).toLocaleString()
                  : "unknown";
                return (
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
                        Token expires: {exp}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="destructive"
                        onClick={() => void handleUnlink(c.characterId)}
                      >
                        Remove
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
