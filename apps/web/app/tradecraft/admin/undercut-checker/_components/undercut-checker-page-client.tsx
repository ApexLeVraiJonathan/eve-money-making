"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@eve/ui";
import {
  useTrackedStations,
  useArbitrageCommits,
  useUndercutCheck,
  useCycleLines,
  useAddBulkRelistFees,
  useUpdateBulkSellPrices,
  useSelfMarketStatus,
} from "../../../api";
import type { UndercutCheckGroup } from "@eve/shared/tradecraft-pricing";
import {
  buildConfirmRepricePayload,
  buildGroupsToRender,
  buildInitialSelectionState,
  getPreferredCycleId,
  parseResolvedStructureId,
} from "./lib/undercut-checker-helpers";
import { createSelectionStore, type SelectionStore } from "./lib/selection-store";
import type { GroupingMode } from "./lib/types";
import { UndercutConfigCard } from "./sections/undercut-config-card";
import { UndercutCheckerPageHero } from "./sections/undercut-checker-page-hero";
import { UndercutResultsSection } from "./sections/undercut-results-section";

export default function UndercutCheckerPageClient() {
  const [selectedStations, setSelectedStations] = useState<number[]>([]);
  const [result, setResult] = useState<UndercutCheckGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useCommit, setUseCommit] = useState<boolean>(true);
  const [cycleId, setCycleId] = useState<string>("");
  const [groupingMode, setGroupingMode] = useState<GroupingMode>("perCharacter");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showNegativeProfit, setShowNegativeProfit] = useState<boolean>(false);
  const RELIST_PCT = Number(process.env.NEXT_PUBLIC_BROKER_RELIST_PCT ?? 0.3);

  const selectionStoreRef = useRef<SelectionStore | null>(null);
  if (!selectionStoreRef.current) {
    selectionStoreRef.current = createSelectionStore();
  }
  const selectionStore = selectionStoreRef.current;

  const { data: stations = [] } = useTrackedStations();
  const selfMarketStatusQ = useSelfMarketStatus();
  const { data: latestCycles = [] } = useArbitrageCommits(
    { limit: 5 },
    { enabled: useCommit },
  );
  const undercutCheckMutation = useUndercutCheck();
  const { data: cycleLines = [] } = useCycleLines(cycleId);
  const addBulkRelistFeesMutation = useAddBulkRelistFees();
  const updateBulkSellPricesMutation = useUpdateBulkSellPrices();

  const selfMarketStructureId = useMemo(
    () => parseResolvedStructureId(selfMarketStatusQ.data?.resolvedStructureId),
    [selfMarketStatusQ.data?.resolvedStructureId],
  );

  useEffect(() => {
    if (!useCommit) return;
    const preferredCycleId = getPreferredCycleId(latestCycles);
    if (preferredCycleId) setCycleId(preferredCycleId);
  }, [useCommit, latestCycles]);

  useEffect(() => {
    if (useCommit) return;
    if (selfMarketStructureId === null) return;
    if (selectedStations.length > 0) return;
    setSelectedStations([selfMarketStructureId]);
  }, [useCommit, selfMarketStructureId, selectedStations.length]);

  const groupsToRender = useMemo(
    () => buildGroupsToRender(result, showNegativeProfit),
    [result, showNegativeProfit],
  );

  const isCnSelected =
    !useCommit &&
    selfMarketStructureId !== null &&
    selectedStations.includes(selfMarketStructureId);

  const onRun = async () => {
    setError(null);
    setResult(null);
    try {
      const data = await undercutCheckMutation.mutateAsync({
        stationIds: useCommit
          ? undefined
          : selectedStations.length
            ? selectedStations
            : undefined,
        cycleId: useCommit && cycleId ? cycleId : undefined,
        groupingMode,
      });

      selectionStore.replaceAll(buildInitialSelectionState(data));
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Request failed");
    }
  };

  const copyPrice = async (price: number, key: string) => {
    try {
      await navigator.clipboard.writeText(price.toFixed(2));
      setCopiedKey(key);
    } catch (err) {
      console.error("Failed to copy price:", err);
    }
  };

  const onConfirmReprice = async () => {
    if (!cycleId || !result || cycleLines.length === 0) return;
    setError(null);

    const { errors, relistFees, priceUpdates } = buildConfirmRepricePayload({
      result,
      cycleLines,
      selection: selectionStore,
      relistPct: RELIST_PCT,
    });

    if (errors.length) {
      setError(errors.join("\n"));
      return;
    }

    try {
      await addBulkRelistFeesMutation.mutateAsync({ fees: relistFees });
    } catch (e) {
      setError(
        `Failed to add relist fees: ${e instanceof Error ? e.message : String(e)}`,
      );
      return;
    }

    try {
      await updateBulkSellPricesMutation.mutateAsync({ updates: priceUpdates });
    } catch (e) {
      setError(
        `Failed to update sell prices: ${e instanceof Error ? e.message : String(e)}`,
      );
      return;
    }

    setError(null);
    alert("Relist fees recorded successfully!");
  };

  return (
    <div className="p-6 space-y-6">
      <UndercutCheckerPageHero />

      <UndercutConfigCard
        useCommit={useCommit}
        setUseCommit={setUseCommit}
        groupingMode={groupingMode}
        setGroupingMode={setGroupingMode}
        showNegativeProfit={showNegativeProfit}
        setShowNegativeProfit={setShowNegativeProfit}
        cycleId={cycleId}
        setCycleId={setCycleId}
        selectedStations={selectedStations}
        setSelectedStations={(updater) => setSelectedStations(updater)}
        selfMarketStructureId={selfMarketStructureId}
        stations={stations}
        onRun={onRun}
        isPending={undercutCheckMutation.isPending}
        isCnSelected={isCnSelected}
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <UndercutResultsSection
        result={result}
        groupsToRender={groupsToRender}
        onConfirmReprice={onConfirmReprice}
        canConfirm={useCommit && Boolean(cycleId)}
        selectionStore={selectionStore}
        copiedKey={copiedKey}
        onCopyPrice={copyPrice}
        relistPct={RELIST_PCT}
      />
    </div>
  );
}
