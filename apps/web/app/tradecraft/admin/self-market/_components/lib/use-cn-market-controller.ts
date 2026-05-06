"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useSelfMarketDailyAggregates,
  useSelfMarketClearDailyAggregates,
  useSelfMarketCollect,
  useSelfMarketSnapshotLatest,
  useSelfMarketSnapshotLatestTypeSummary,
  useSelfMarketStatus,
} from "../../../../api";
import { utcToday } from "./market-utils";
import {
  getSnapshotFreshness,
  getTopCnError,
  type MarketHub,
  type MarketViewTab,
} from "./page-helpers";

export function useCnMarketController(hub: MarketHub) {
  const qc = useQueryClient();
  const [tab, setTab] = React.useState<MarketViewTab>("snapshot");
  const [forceRefresh, setForceRefresh] = React.useState<boolean>(false);
  const [openTypeIds, setOpenTypeIds] = React.useState<number[]>([]);

  const [snapshotLimit, setSnapshotLimit] = React.useState<number>(200);
  const [perTypeLimit, setPerTypeLimit] = React.useState<number>(500);
  const [snapshotSide, setSnapshotSide] = React.useState<"ALL" | "BUY" | "SELL">(
    "ALL",
  );
  const [snapshotTypeId, setSnapshotTypeId] = React.useState<string>("");

  const [dailyDate, setDailyDate] = React.useState<string>(utcToday());
  const [dailyMode, setDailyMode] = React.useState<"LOWER" | "UPPER">("LOWER");
  const [dailySide, setDailySide] = React.useState<"ALL" | "BUY" | "SELL">("SELL");
  const [dailyLimit, setDailyLimit] = React.useState<number>(500);
  const [dailyTypeId, setDailyTypeId] = React.useState<string>("");

  const statusQ = useSelfMarketStatus();
  const hasTypeFilter = Boolean(snapshotTypeId.trim());
  const snapshotQ = useSelfMarketSnapshotLatest(
    {
      limit: perTypeLimit,
      side: snapshotSide,
      typeId: snapshotTypeId.trim() ? Number(snapshotTypeId) : undefined,
    },
    { enabled: hasTypeFilter },
  );
  const snapshotTypesQ = useSelfMarketSnapshotLatestTypeSummary(
    {
      limitTypes: snapshotLimit,
      side: snapshotSide,
    },
    { enabled: !hasTypeFilter },
  );
  const dailyQ = useSelfMarketDailyAggregates({
    date: dailyDate,
    hasGone: dailyMode === "UPPER",
    side: dailySide,
    limit: dailyLimit,
    typeId: dailyTypeId.trim() ? Number(dailyTypeId) : undefined,
  });
  const collectM = useSelfMarketCollect();
  const clearDailyM = useSelfMarketClearDailyAggregates();

  const status = statusQ.data;
  const enabled = status?.cron.effectiveEnabled ?? false;
  const { ageMins: snapshotAgeMins, isStale: snapshotIsStale } =
    getSnapshotFreshness(status?.latestSnapshot?.observedAt);

  const topError = getTopCnError({
    statusError: statusQ.error,
    snapshotError: snapshotQ.error,
    snapshotTypesError: snapshotTypesQ.error,
    dailyError: dailyQ.error,
  });

  React.useEffect(() => {
    if (hub !== "cn" || tab !== "daily") return;
    void qc.invalidateQueries({ queryKey: ["selfMarket", "daily"] });
  }, [hub, tab, dailyMode, dailySide, dailyDate, dailyLimit, dailyTypeId, qc]);

  const onCollectCn = () => {
    void collectM.mutateAsync({ forceRefresh }).then(() => {
      void statusQ.refetch();
      if (tab === "snapshot") void snapshotQ.refetch();
      if (tab === "daily") void dailyQ.refetch();
    });
  };

  const onRefreshCn = () => {
    void statusQ.refetch();
    if (tab === "snapshot") void snapshotQ.refetch();
    if (tab === "daily") void dailyQ.refetch();
  };

  const onReloadSnapshotCn = () => {
    setOpenTypeIds([]);
    if (hasTypeFilter) void snapshotQ.refetch();
    else void snapshotTypesQ.refetch();
  };

  const onClearDailyCn = () => {
    void clearDailyM.mutateAsync({ date: dailyDate }).then(() => {
      void dailyQ.refetch();
      void statusQ.refetch();
    });
  };

  return {
    topError,
    collectM,
    clearDailyM,
    enabled,
    snapshotIsStale,
    snapshotAgeMins,
    status,
    statusQ,
    tab,
    setTab,
    forceRefresh,
    setForceRefresh,
    snapshotLimit,
    setSnapshotLimit,
    perTypeLimit,
    setPerTypeLimit,
    snapshotSide,
    setSnapshotSide,
    snapshotTypeId,
    setSnapshotTypeId,
    hasTypeFilter,
    openTypeIds,
    setOpenTypeIds,
    snapshotQ,
    snapshotTypesQ,
    dailyDate,
    setDailyDate,
    dailyMode,
    setDailyMode,
    dailySide,
    setDailySide,
    dailyLimit,
    setDailyLimit,
    dailyTypeId,
    setDailyTypeId,
    dailyQ,
    onCollectCn,
    onRefreshCn,
    onReloadSnapshotCn,
    onReloadDailyCn: () => void dailyQ.refetch(),
    onClearDailyCn,
  };
}
