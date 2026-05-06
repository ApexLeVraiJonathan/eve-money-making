"use client";

import { useMemo, useState } from "react";
import { toast } from "@eve/ui";
import {
  startCharacterLink,
  useCurrentUser,
  useMyCharacters,
  useSetPrimaryCharacter,
  useUnlinkCharacter,
  useUpdateUserFeatures,
  useUserFeatures,
} from "../../tradecraft/api/characters/users.hooks";
import { useCharacterOverview, useMyAccounts } from "../api";
import { AccountsCharactersSection } from "./sections/accounts-characters-section";
import { PageHeroSection } from "./sections/page-hero-section";
import { UnassignedCharactersCard } from "./sections/unassigned-characters-card";

export function CharactersPageClient() {
  const { data: me } = useCurrentUser();
  const { data: features } = useUserFeatures();
  const { data: linkedChars = [], isLoading: linkedCharsLoading } =
    useMyCharacters();
  const { data: overview, isLoading: overviewLoading } = useCharacterOverview();
  const { data: accountsData, isLoading: accountsLoading } = useMyAccounts();

  const setPrimaryMutation = useSetPrimaryCharacter();
  const unlinkMutation = useUnlinkCharacter();
  const updateFeatures = useUpdateUserFeatures();

  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedAccounts, setCollapsedAccounts] = useState<Set<string>>(
    new Set(),
  );
  const [featureDialogOpen, setFeatureDialogOpen] = useState(false);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);

  const enabledFeatures = features?.enabledFeatures ?? [];
  const accounts = useMemo(
    () => accountsData?.accounts ?? [],
    [accountsData?.accounts],
  );
  const unassigned = accountsData?.unassignedCharacters ?? [];
  const overviewCharacters = overview?.characters ?? [];
  const isHeroLoading =
    overviewLoading || accountsLoading || linkedCharsLoading;

  const totalWallet = (overview?.characters ?? []).reduce(
    (sum, character) => sum + (character.walletBalanceIsk ?? 0),
    0,
  );

  const filteredAccounts = useMemo(() => {
    if (!searchQuery.trim()) return accounts;

    return accounts
      .map((account) => ({
        ...account,
        characters: account.characters.filter((character) =>
          character.name.toLowerCase().includes(searchQuery.toLowerCase()),
        ),
      }))
      .filter((account) => account.characters.length > 0);
  }, [accounts, searchQuery]);

  const totalFilteredCharacters = useMemo(
    () => filteredAccounts.reduce((sum, account) => sum + account.characters.length, 0),
    [filteredAccounts],
  );

  const toggleFeature = (key: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(key) ? prev.filter((current) => current !== key) : [...prev, key],
    );
  };

  const handleSaveFeatures = async () => {
    try {
      const next = selectedFeatures.length ? selectedFeatures : enabledFeatures;
      await updateFeatures.mutateAsync(next);
      toast.success("App access updated");
      setFeatureDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const toggleAccountCollapse = (accountId: string) => {
    setCollapsedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  };

  const handleSetPrimary = async (id: number) => {
    try {
      await setPrimaryMutation.mutateAsync(id);
      toast.success("Primary character updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleUnlink = async (id: number) => {
    try {
      await unlinkMutation.mutateAsync(id);
      toast.success("Character unlinked");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleStartLink = () => {
    startCharacterLink(window.location.href);
  };

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6 md:p-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Characters
          </h1>
          <p className="text-sm text-foreground/70">
            Manage linked characters, assign accounts, track boosters, and
            control subscriptions.
          </p>
        </div>
      </div>

      <PageHeroSection
        linkedCharsLoading={linkedCharsLoading}
        linkedChars={linkedChars}
        accountsCount={accounts.length}
        totalWallet={totalWallet}
        isHeroLoading={isHeroLoading}
        currentCharacterName={me?.characterName}
        enabledFeatures={enabledFeatures}
        featureDialogOpen={featureDialogOpen}
        onFeatureDialogOpenChange={setFeatureDialogOpen}
        selectedFeatures={selectedFeatures}
        onToggleFeature={toggleFeature}
        onSaveFeatures={handleSaveFeatures}
        updateFeaturesPending={updateFeatures.isPending}
        onStartLink={handleStartLink}
      />

      <section className="space-y-6">
        <AccountsCharactersSection
          accountsLoading={accountsLoading}
          accounts={accounts}
          filteredAccounts={filteredAccounts}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          totalFilteredCharacters={totalFilteredCharacters}
          unassigned={unassigned.map((character) => ({
            id: character.id,
            name: character.name,
          }))}
          collapsedAccounts={collapsedAccounts}
          onToggleAccountCollapse={toggleAccountCollapse}
          linkedChars={linkedChars}
          overviewCharacters={overviewCharacters}
          onSetPrimary={handleSetPrimary}
          onUnlink={handleUnlink}
          setPrimaryPending={setPrimaryMutation.isPending}
          unlinkPending={unlinkMutation.isPending}
        />

        <UnassignedCharactersCard characters={unassigned} accounts={accounts} />
      </section>
    </div>
  );
}
