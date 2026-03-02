"use client";

import { Card, CardContent, CardHeader, CardTitle, Input, Separator, Skeleton } from "@eve/ui";
import { ChevronDown, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CharacterOverview } from "../../api";
import { AccountStatusSummary } from "./account-status-summary";
import { CharacterCardDisplay } from "./character-card-display";
import { DeleteAccountButton } from "./delete-account-button";
import { NewAccountDialog } from "./new-account-dialog";

type AccountCharacter = { id: number; name: string; tokenStatus: string };

type AccountRecord = {
  id: string;
  label: string | null;
  plex: {
    expiresAt: string;
    daysRemaining: number | null;
    status: "none" | "active" | "expired" | "upcoming";
  } | null;
  characters: AccountCharacter[];
};

type AccountsCharactersSectionProps = {
  accountsLoading: boolean;
  accounts: AccountRecord[];
  filteredAccounts: AccountRecord[];
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  totalFilteredCharacters: number;
  unassigned: { id: number; name: string }[];
  collapsedAccounts: Set<string>;
  onToggleAccountCollapse: (accountId: string) => void;
  linkedChars: { id: number; isPrimary: boolean }[];
  overviewCharacters: CharacterOverview[];
  onSetPrimary: (id: number) => void | Promise<void>;
  onUnlink: (id: number) => void | Promise<void>;
  setPrimaryPending: boolean;
  unlinkPending: boolean;
};

export function AccountsCharactersSection({
  accountsLoading,
  accounts,
  filteredAccounts,
  searchQuery,
  onSearchQueryChange,
  totalFilteredCharacters,
  unassigned,
  collapsedAccounts,
  onToggleAccountCollapse,
  linkedChars,
  overviewCharacters,
  onSetPrimary,
  onUnlink,
  setPrimaryPending,
  unlinkPending,
}: AccountsCharactersSectionProps) {
  return (
    <Card className="shadow-md bg-gradient-to-b from-background to-muted/10">
      <CardHeader className="space-y-4">
        <div className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Accounts & characters</CardTitle>
          <NewAccountDialog unassigned={unassigned} />
        </div>
        {accounts.length > 0 && (
          <div className="space-y-2">
            <Input
              type="search"
              placeholder="Search characters..."
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              className="max-w-sm"
            />
            {searchQuery && (
              <p className="text-sm text-muted-foreground">
                Found {totalFilteredCharacters} character(s) matching&nbsp;
                &quot;{searchQuery}&quot;
              </p>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-8">
        {accountsLoading ? (
          <AccountsSkeleton />
        ) : filteredAccounts.length === 0 && searchQuery ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Users className="mb-3 h-10 w-10 text-foreground/50" />
            <p className="text-sm text-foreground/80 font-medium mb-1">
              No characters found
            </p>
            <p className="text-sm text-foreground/60">
              Try a different search term or clear the filter
            </p>
          </div>
        ) : accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Users className="mb-3 h-10 w-10 text-foreground/50" />
            <p className="text-sm text-foreground/70">
              No accounts created yet. Link a character, then create accounts and
              assign characters to them.
            </p>
          </div>
        ) : (
          filteredAccounts.map((account, index) => (
            <div key={account.id} className="space-y-4">
              {index > 0 && (
                <Separator className="my-4 bg-gradient-to-r from-transparent via-border to-transparent" />
              )}
              <div className="space-y-4">
                <div className="space-y-3 rounded-lg bg-gradient-to-br from-muted/30 to-muted/10 p-4 shadow-sm border">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      onClick={() => onToggleAccountCollapse(account.id)}
                      className="flex flex-1 items-center justify-between text-left hover:opacity-80 transition-opacity"
                    >
                      <h3 className="text-xl font-bold">{account.label || "Account"}</h3>
                      <ChevronDown
                        className={cn(
                          "h-5 w-5 transition-transform duration-200",
                          collapsedAccounts.has(account.id) && "rotate-180",
                        )}
                      />
                    </button>
                    <DeleteAccountButton accountId={account.id} />
                  </div>
                  {!collapsedAccounts.has(account.id) && (
                    <AccountStatusSummary accountId={account.id} plex={account.plex} />
                  )}
                </div>
                {!collapsedAccounts.has(account.id) &&
                  account.characters.length > 0 && (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {account.characters.map((character) => {
                        const primaryMatch = linkedChars.find(
                          (linked) => linked.id === character.id && linked.isPrimary,
                        );
                        const isPrimary = !!primaryMatch;
                        return (
                          <CharacterCardDisplay
                            key={character.id}
                            char={character}
                            isPrimary={isPrimary}
                            accountId={account.id}
                            overviewCharacters={overviewCharacters}
                            onSetPrimary={onSetPrimary}
                            onUnlink={onUnlink}
                            setPrimaryPending={setPrimaryPending}
                            unlinkPending={unlinkPending}
                          />
                        );
                      })}
                    </div>
                  )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function AccountsSkeleton() {
  return (
    <div className="space-y-8">
      {[0, 1].map((group) => (
        <div key={group} className="space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((card) => (
              <Skeleton key={card} className="h-48 w-full rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
