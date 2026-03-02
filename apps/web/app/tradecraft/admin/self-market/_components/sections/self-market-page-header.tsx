"use client";

import * as React from "react";
import { Button, TabsList, TabsTrigger } from "@eve/ui";
import { Database, Loader2, RefreshCw } from "lucide-react";
import type { MarketHub } from "../lib/page-helpers";

type SelfMarketPageHeaderProps = {
  hub: MarketHub;
  forceRefresh: boolean;
  setForceRefresh: React.Dispatch<React.SetStateAction<boolean>>;
  npcForceRefresh: boolean;
  setNpcForceRefresh: React.Dispatch<React.SetStateAction<boolean>>;
  onCollectCn: () => void;
  onRefreshCn: () => void;
  onCollectNpc: () => void;
  onRefreshNpc: () => void;
  isCollectCnPending: boolean;
  isCollectNpcPending: boolean;
};

export function SelfMarketPageHeader(props: SelfMarketPageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          <h1 className="text-2xl font-semibold">Self Market</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Inspect collected snapshots and computed daily aggregates.
        </p>
        <TabsList>
          <TabsTrigger value="cn">C-N (Structure)</TabsTrigger>
          <TabsTrigger value="rens">Rens (NPC)</TabsTrigger>
        </TabsList>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {props.hub === "cn" ? (
          <>
            <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={props.forceRefresh}
                onChange={(e) => props.setForceRefresh(e.target.checked)}
              />
              Force refresh
            </label>
            <Button onClick={props.onCollectCn} disabled={props.isCollectCnPending}>
              {props.isCollectCnPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Database className="mr-2 h-4 w-4" />
              )}
              Collect now
            </Button>
            <Button variant="outline" onClick={props.onRefreshCn}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </>
        ) : (
          <>
            <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={props.npcForceRefresh}
                onChange={(e) => props.setNpcForceRefresh(e.target.checked)}
              />
              Force refresh
            </label>
            <Button onClick={props.onCollectNpc} disabled={props.isCollectNpcPending}>
              {props.isCollectNpcPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Database className="mr-2 h-4 w-4" />
              )}
              Collect now (Rens)
            </Button>
            <Button variant="outline" onClick={props.onRefreshNpc}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
