"use client";

import * as React from "react";
import { Tabs } from "@eve/ui";
import {
  NPC_RENS_STATION_ID,
  type MarketHub,
} from "./lib/page-helpers";
import { useCnMarketController } from "./lib/use-cn-market-controller";
import { useRensMarketController } from "./lib/use-rens-market-controller";
import { useTypeNameCopy } from "./lib/use-type-name-copy";
import { CnMarketTabSection } from "./sections/cn-market-tab";
import { RensMarketTabSection } from "./sections/rens-market-tab";
import { SelfMarketPageHeader } from "./sections/self-market-page-header";

export default function SelfMarketPageClient() {
  const [hub, setHub] = React.useState<MarketHub>("cn");
  const npcStationId = NPC_RENS_STATION_ID;
  const cn = useCnMarketController(hub);
  const rens = useRensMarketController(npcStationId);
  const { copiedTypeId, onCopyTypeName } = useTypeNameCopy();

  return (
    <div className="space-y-6 p-6">
      <Tabs value={hub} onValueChange={(v) => setHub(v === "rens" ? "rens" : "cn")}>
        <SelfMarketPageHeader
          hub={hub}
          forceRefresh={cn.forceRefresh}
          setForceRefresh={cn.setForceRefresh}
          npcForceRefresh={rens.npcForceRefresh}
          setNpcForceRefresh={rens.setNpcForceRefresh}
          onCollectCn={cn.onCollectCn}
          onRefreshCn={cn.onRefreshCn}
          onCollectNpc={rens.onCollectNpc}
          onRefreshNpc={rens.onRefreshNpc}
          isCollectCnPending={cn.collectM.isPending}
          isCollectNpcPending={rens.npcCollectM.isPending}
        />
        <CnMarketTabSection
          topError={cn.topError}
          collectM={cn.collectM}
          clearDailyM={cn.clearDailyM}
          enabled={cn.enabled}
          snapshotIsStale={cn.snapshotIsStale}
          snapshotAgeMins={cn.snapshotAgeMins}
          status={cn.status}
          statusQ={cn.statusQ}
          tab={cn.tab}
          setTab={cn.setTab}
          snapshotLimit={cn.snapshotLimit}
          setSnapshotLimit={cn.setSnapshotLimit}
          perTypeLimit={cn.perTypeLimit}
          setPerTypeLimit={cn.setPerTypeLimit}
          snapshotSide={cn.snapshotSide}
          setSnapshotSide={cn.setSnapshotSide}
          snapshotTypeId={cn.snapshotTypeId}
          setSnapshotTypeId={cn.setSnapshotTypeId}
          hasTypeFilter={cn.hasTypeFilter}
          openTypeIds={cn.openTypeIds}
          setOpenTypeIds={cn.setOpenTypeIds}
          copiedTypeId={copiedTypeId}
          snapshotQ={cn.snapshotQ}
          snapshotTypesQ={cn.snapshotTypesQ}
          dailyDate={cn.dailyDate}
          setDailyDate={cn.setDailyDate}
          dailyMode={cn.dailyMode}
          setDailyMode={cn.setDailyMode}
          dailySide={cn.dailySide}
          setDailySide={cn.setDailySide}
          dailyLimit={cn.dailyLimit}
          setDailyLimit={cn.setDailyLimit}
          dailyTypeId={cn.dailyTypeId}
          setDailyTypeId={cn.setDailyTypeId}
          dailyQ={cn.dailyQ}
          onCopyTypeName={onCopyTypeName}
          onReloadSnapshot={cn.onReloadSnapshotCn}
          onReloadDaily={cn.onReloadDailyCn}
          onClearDaily={cn.onClearDailyCn}
        />

        <RensMarketTabSection
          stationId={npcStationId}
          npcSnapshotIsStale={rens.npcSnapshotIsStale}
          npcSnapshotAgeMins={rens.npcSnapshotAgeMins}
          npcStatusQ={rens.npcStatusQ}
          npcCollectM={rens.npcCollectM}
          npcTab={rens.npcTab}
          setNpcTab={rens.setNpcTab}
          npcSnapshotLimit={rens.npcSnapshotLimit}
          setNpcSnapshotLimit={rens.setNpcSnapshotLimit}
          npcPerTypeLimit={rens.npcPerTypeLimit}
          setNpcPerTypeLimit={rens.setNpcPerTypeLimit}
          npcSnapshotSide={rens.npcSnapshotSide}
          setNpcSnapshotSide={rens.setNpcSnapshotSide}
          npcOpenTypeIds={rens.npcOpenTypeIds}
          setNpcOpenTypeIds={rens.setNpcOpenTypeIds}
          npcTypesQ={rens.npcTypesQ}
          npcDailyDate={rens.npcDailyDate}
          setNpcDailyDate={rens.setNpcDailyDate}
          npcDailyHasGone={rens.npcDailyHasGone}
          setNpcDailyHasGone={rens.setNpcDailyHasGone}
          npcDailySide={rens.npcDailySide}
          setNpcDailySide={rens.setNpcDailySide}
          npcDailyLimit={rens.npcDailyLimit}
          setNpcDailyLimit={rens.setNpcDailyLimit}
          npcDailyTypeId={rens.npcDailyTypeId}
          setNpcDailyTypeId={rens.setNpcDailyTypeId}
          npcDailyQ={rens.npcDailyQ}
          onReloadNpcSnapshot={rens.onReloadSnapshotNpc}
          onReloadNpcDaily={rens.onReloadDailyNpc}
        />
      </Tabs>
    </div>
  );
}
