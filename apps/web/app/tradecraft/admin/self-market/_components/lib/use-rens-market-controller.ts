"use client";

import * as React from "react";
import {
  useNpcMarketCollect,
  useNpcMarketDailyAggregates,
  useNpcMarketSnapshotLatestTypeSummary,
  useNpcMarketStatus,
} from "../../../../api";
import { utcToday } from "./market-utils";
import { getSnapshotFreshness, type MarketViewTab } from "./page-helpers";

export function useRensMarketController(stationId: number) {
  const [npcForceRefresh, setNpcForceRefresh] = React.useState<boolean>(false);
  const [npcTab, setNpcTab] = React.useState<MarketViewTab>("snapshot");
  const [npcSnapshotLimit, setNpcSnapshotLimit] = React.useState<number>(200);
  const [npcPerTypeLimit, setNpcPerTypeLimit] = React.useState<number>(500);
  const [npcSnapshotSide, setNpcSnapshotSide] = React.useState<
    "ALL" | "BUY" | "SELL"
  >("ALL");
  const [npcOpenTypeIds, setNpcOpenTypeIds] = React.useState<number[]>([]);
  const [npcDailyDate, setNpcDailyDate] = React.useState<string>(utcToday());
  const [npcDailyHasGone, setNpcDailyHasGone] = React.useState<boolean>(false);
  const [npcDailySide, setNpcDailySide] = React.useState<"ALL" | "BUY" | "SELL">(
    "SELL",
  );
  const [npcDailyLimit, setNpcDailyLimit] = React.useState<number>(500);
  const [npcDailyTypeId, setNpcDailyTypeId] = React.useState<string>("");

  const npcStatusQ = useNpcMarketStatus({ stationId });
  const npcTypesQ = useNpcMarketSnapshotLatestTypeSummary(
    {
      stationId,
      limitTypes: npcSnapshotLimit,
      side: npcSnapshotSide,
    },
    { enabled: npcTab === "snapshot" },
  );
  const npcCollectM = useNpcMarketCollect();
  const npcDailyQ = useNpcMarketDailyAggregates({
    stationId,
    date: npcDailyDate,
    hasGone: npcDailyHasGone,
    side: npcDailySide,
    limit: npcDailyLimit,
    typeId: npcDailyTypeId.trim() ? Number(npcDailyTypeId) : undefined,
  });

  const { ageMins: npcSnapshotAgeMins, isStale: npcSnapshotIsStale } =
    getSnapshotFreshness(npcStatusQ.data?.latestSnapshot?.observedAt ?? null);

  const onCollectNpc = () => {
    void npcCollectM
      .mutateAsync({
        stationId,
        forceRefresh: npcForceRefresh,
      })
      .then(() => {
        void npcStatusQ.refetch();
        if (npcTab === "snapshot") void npcTypesQ.refetch();
        if (npcTab === "daily") void npcDailyQ.refetch();
      });
  };

  const onRefreshNpc = () => {
    void npcStatusQ.refetch();
    if (npcTab === "snapshot") void npcTypesQ.refetch();
    if (npcTab === "daily") void npcDailyQ.refetch();
  };

  const onReloadSnapshotNpc = () => {
    setNpcOpenTypeIds([]);
    void npcTypesQ.refetch();
  };

  return {
    npcForceRefresh,
    setNpcForceRefresh,
    npcSnapshotIsStale,
    npcSnapshotAgeMins,
    npcStatusQ,
    npcCollectM,
    npcTab,
    setNpcTab,
    npcSnapshotLimit,
    setNpcSnapshotLimit,
    npcPerTypeLimit,
    setNpcPerTypeLimit,
    npcSnapshotSide,
    setNpcSnapshotSide,
    npcOpenTypeIds,
    setNpcOpenTypeIds,
    npcTypesQ,
    npcDailyDate,
    setNpcDailyDate,
    npcDailyHasGone,
    setNpcDailyHasGone,
    npcDailySide,
    setNpcDailySide,
    npcDailyLimit,
    setNpcDailyLimit,
    npcDailyTypeId,
    setNpcDailyTypeId,
    npcDailyQ,
    onCollectNpc,
    onRefreshNpc,
    onReloadSnapshotNpc,
    onReloadDailyNpc: () => void npcDailyQ.refetch(),
  };
}
