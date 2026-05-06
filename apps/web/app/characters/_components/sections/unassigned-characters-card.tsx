"use client";

import { Avatar, AvatarFallback, AvatarImage, Button, Card, CardContent, CardHeader, CardTitle, Label, toast } from "@eve/ui";
import { useState } from "react";
import { useAssignCharacterToAccount } from "../../api";
import { useUnlinkCharacter } from "../../../tradecraft/api/characters/users.hooks";
import { getCharacterInitials } from "../lib/character-utils";

type UnassignedCharactersCardProps = {
  characters: { id: number; name: string; tokenStatus: string }[];
  accounts: { id: string; label: string | null }[];
};

export function UnassignedCharactersCard({
  characters,
  accounts,
}: UnassignedCharactersCardProps) {
  const assign = useAssignCharacterToAccount();
  const unlink = useUnlinkCharacter();

  const handleAssign = async (characterId: number, accountId: string) => {
    if (!accountId) {
      toast.error("Choose an account");
      return;
    }
    try {
      await assign.mutateAsync({ accountId, characterId });
      toast.success("Character assigned to account");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleUnlink = async (characterId: number) => {
    try {
      await unlink.mutateAsync(characterId);
      toast.success("Character unlinked");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Unassigned characters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {characters.length === 0 ? (
          <p className="text-muted-foreground">
            All characters are currently assigned to accounts.
          </p>
        ) : (
          characters.map((char) => (
            <div
              key={char.id}
              className="flex items-center justify-between gap-3 rounded-md border bg-background p-3"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage
                    src={`https://image.eveonline.com/Character/${char.id}_128.jpg`}
                    alt={char.name}
                  />
                  <AvatarFallback className="rounded-lg">
                    {getCharacterInitials(char.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">{char.name}</div>
                  <p className="text-[11px]">
                    Token: {char.tokenStatus ?? "unknown"}
                  </p>
                </div>
              </div>
              <div className="flex items-end gap-2">
                <AssignCharacterToAccountSelect
                  characterId={char.id}
                  accounts={accounts}
                  onAssign={handleAssign}
                  disabled={assign.isPending}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-9"
                  onClick={() => void handleUnlink(char.id)}
                  disabled={unlink.isPending}
                >
                  Unlink
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

type AssignCharacterToAccountSelectProps = {
  characterId: number;
  accounts: { id: string; label: string | null }[];
  onAssign: (characterId: number, accountId: string) => void | Promise<void>;
  disabled?: boolean;
};

function AssignCharacterToAccountSelect({
  characterId,
  accounts,
  onAssign,
  disabled,
}: AssignCharacterToAccountSelectProps) {
  const [accountId, setAccountId] = useState<string>("");

  return (
    <div className="flex items-end gap-2">
      <div className="space-y-1">
        <Label htmlFor={`assign-${characterId}`}>Account</Label>
        <select
          id={`assign-${characterId}`}
          className="w-40 rounded-md border bg-background px-2 py-1 text-xs"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
        >
          <option value="">Choose…</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.label || "Account"}
            </option>
          ))}
        </select>
      </div>
      <Button
        size="sm"
        className="text-xs"
        onClick={() => void onAssign(characterId, accountId)}
        disabled={disabled || !accountId}
      >
        Assign
      </Button>
    </div>
  );
}
