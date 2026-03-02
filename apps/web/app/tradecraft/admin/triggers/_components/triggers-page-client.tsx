"use client";

import { Tabs } from "@eve/ui";
import { ImportsTab } from "../imports-tab";
import { ParticipationsTab } from "../participations-tab";
import { FinancialTab } from "../financial-tab";
import { SystemCleanupTab } from "../system-cleanup-tab";
import { TriggersPageHeader } from "./sections/triggers-page-header";
import { TriggersTabsList } from "./sections/triggers-tabs-list";
import { useTriggersPageController } from "./lib/use-triggers-page-controller";

export default function TriggersPageClient() {
  const {
    loading,
    batchSize,
    setBatchSize,
    tradeDate,
    setTradeDate,
    daysBack,
    setDaysBack,
    stationId,
    setStationId,
    trackedStations,
    importSummary,
    marketStaleness,
    matchResult,
    snapshots,
    currentCycleId,
    missingTradesNote,
    triggerImport,
    addTrackedStation,
    removeTrackedStation,
    createSnapshot,
    matchParticipationPayments,
  } = useTriggersPageController();

  return (
    <div className="container mx-auto max-w-7xl p-6 space-y-6">
      <TriggersPageHeader />

      <Tabs defaultValue="imports" className="space-y-6">
        <TriggersTabsList />

        <ImportsTab
          loading={loading}
          batchSize={batchSize}
          setBatchSize={setBatchSize}
          tradeDate={tradeDate}
          setTradeDate={setTradeDate}
          daysBack={daysBack}
          setDaysBack={setDaysBack}
          stationId={stationId}
          setStationId={setStationId}
          trackedStations={trackedStations}
          importSummary={importSummary}
          marketStaleness={marketStaleness}
          missingTradesNote={missingTradesNote}
          triggerImport={triggerImport}
          addTrackedStation={addTrackedStation}
          removeTrackedStation={removeTrackedStation}
        />

        <ParticipationsTab
          loading={loading}
          matchResult={matchResult}
          matchParticipationPayments={matchParticipationPayments}
        />

        <FinancialTab
          loading={loading}
          currentCycleId={currentCycleId}
          snapshots={snapshots}
          createSnapshot={createSnapshot}
        />

        <SystemCleanupTab />
      </Tabs>
    </div>
  );
}
