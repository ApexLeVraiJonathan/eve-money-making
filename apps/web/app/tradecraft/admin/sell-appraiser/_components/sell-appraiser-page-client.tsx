"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@eve/ui";
import {
  useTrackedStations,
  useArbitrageCommits,
  useSellAppraise,
  useSellAppraiseByCommit,
  useCycleLines,
  useAddBulkBrokerFees,
  useUpdateBulkSellPrices,
  useSelfMarketStatus,
} from "../../../api";
import type { SellAppraiserRow } from "./lib/row-types";
import {
  createSelectionStore,
  type SelectionStore,
} from "./lib/selection-store";
import {
  buildConfirmListedPayload,
  buildInitialSelectionState,
  groupSellAppraiserResults,
  parseResolvedStructureId,
} from "./lib/sell-appraiser-helpers";
import { SellAppraiserConfigCard } from "./sections/sell-appraiser-config-card";
import { SellAppraiserPageHero } from "./sections/sell-appraiser-page-hero";
import { SellAppraiserResultsSection } from "./sections/sell-appraiser-results-section";

export default function SellAppraiserPageClient() {
  const [destinationId, setDestinationId] = useState<number | null>(null);
  const [useCommit, setUseCommit] = useState<boolean>(true);
  const [cycleId, setCycleId] = useState<string>("");
  const [paste, setPaste] = useState("");
  const [result, setResult] = useState<SellAppraiserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const BROKER_FEE_PCT = Number(process.env.NEXT_PUBLIC_BROKER_FEE_PCT ?? 1.5);

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
  const sellAppraiseMutation = useSellAppraise();
  const sellAppraiseByCommitMutation = useSellAppraiseByCommit();
  const { data: cycleLines = [] } = useCycleLines(cycleId);
  const addBulkBrokerFeesMutation = useAddBulkBrokerFees();
  const updateBulkSellPricesMutation = useUpdateBulkSellPrices();

  const selfMarketStructureId = useMemo(
    () => parseResolvedStructureId(selfMarketStatusQ.data?.resolvedStructureId),
    [selfMarketStatusQ.data?.resolvedStructureId],
  );

  const destinationLabel = useCallback(
    (stationId: number) => {
      if (
        selfMarketStructureId !== null &&
        stationId === selfMarketStructureId
      ) {
        return "C-N (Structure)";
      }
      const s = stations.find((x) => x.stationId === stationId);
      return s?.station?.name ?? `Station ${stationId}`;
    },
    [selfMarketStructureId, stations],
  );

  const groupedResults = useMemo(
    () => groupSellAppraiserResults(result, destinationLabel),
    [result, destinationLabel],
  );

  useEffect(() => {
    if (destinationId !== null) return;
    if (selfMarketStructureId !== null) {
      setDestinationId(selfMarketStructureId);
      return;
    }
    if (stations.length > 0) setDestinationId(stations[0].stationId);
  }, [stations, destinationId, selfMarketStructureId]);

  useEffect(() => {
    if (useCommit && latestCycles.length > 0) {
      const openCycle = latestCycles.find((r) => r.status === "OPEN");
      setCycleId(openCycle ? openCycle.id : latestCycles[0].id);
    }
  }, [useCommit, latestCycles]);

  const lines = useMemo(() => paste.split(/\r?\n/).filter(Boolean), [paste]);
  const isCnDestination =
    !useCommit &&
    selfMarketStructureId !== null &&
    destinationId === selfMarketStructureId;

  const onSubmit = async () => {
    setError(null);
    setResult(null);
    try {
      if (useCommit) {
        if (!cycleId) return;
        const data = await sellAppraiseByCommitMutation.mutateAsync({ cycleId });
        setResult(data);
        const initial = buildInitialSelectionState(data, true);
        selectionStore.setMany(Object.keys(initial), true);
      } else {
        if (!destinationId) return;
        const data = await sellAppraiseMutation.mutateAsync({
          lines,
          destinationStationId: destinationId,
        });
        setResult(data);
        const initial = buildInitialSelectionState(data, false);
        selectionStore.setMany(Object.keys(initial), true);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Request failed");
    }
  };

  const copySuggestedPrice = async (price: number, key: string) => {
    try {
      await navigator.clipboard.writeText(price.toFixed(2));
      setCopiedKey(key);
    } catch (err) {
      console.error("Failed to copy suggested price:", err);
    }
  };

  const onConfirmListed = async () => {
    if (!useCommit || !cycleId || !result || cycleLines.length === 0) return;

    setIsConfirming(true);
    setError(null);

    const { errors, brokerFees, priceUpdates } = buildConfirmListedPayload({
      result,
      cycleLines,
      selection: selectionStore,
      brokerFeePct: BROKER_FEE_PCT,
    });

    if (errors.length) {
      setError(errors.join("\n"));
      setIsConfirming(false);
      return;
    }

    try {
      await addBulkBrokerFeesMutation.mutateAsync({ fees: brokerFees });
    } catch (e) {
      setError(
        `Failed to add broker fees: ${e instanceof Error ? e.message : String(e)}`,
      );
      setIsConfirming(false);
      return;
    }

    try {
      await updateBulkSellPricesMutation.mutateAsync({ updates: priceUpdates });
    } catch (e) {
      setError(
        `Failed to update sell prices: ${e instanceof Error ? e.message : String(e)}`,
      );
      setIsConfirming(false);
      return;
    }

    setError(null);
    alert("Broker fees recorded and current sell prices updated successfully!");
    setIsConfirming(false);
  };

  return (
    <div className="p-6 space-y-6">
      <SellAppraiserPageHero />

      <SellAppraiserConfigCard
        useCommit={useCommit}
        setUseCommit={setUseCommit}
        cycleId={cycleId}
        setCycleId={setCycleId}
        destinationId={destinationId}
        setDestinationId={setDestinationId}
        selfMarketStructureId={selfMarketStructureId}
        stations={stations}
        paste={paste}
        setPaste={setPaste}
        onSubmit={onSubmit}
        isPending={
          sellAppraiseMutation.isPending || sellAppraiseByCommitMutation.isPending
        }
        isCnDestination={isCnDestination}
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="whitespace-pre-line">{error}</AlertDescription>
        </Alert>
      )}

      <SellAppraiserResultsSection
        groupedResults={groupedResults}
        useCommit={useCommit}
        onConfirmListed={onConfirmListed}
        isConfirming={isConfirming}
        cycleId={cycleId}
        selectionStore={selectionStore}
        copiedKey={copiedKey}
        onCopySuggestedPrice={copySuggestedPrice}
        brokerFeePct={BROKER_FEE_PCT}
      />
    </div>
  );
}
