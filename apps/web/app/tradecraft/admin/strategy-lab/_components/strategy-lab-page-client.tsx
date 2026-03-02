"use client";

import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@eve/ui";
import { Alert, AlertDescription } from "@eve/ui";
import { RunsTabContent } from "./sections/runs-tab-content";
import { StrategiesTabContent } from "./sections/strategies-tab-content";
import { useStrategyLabPageState } from "./lib/use-strategy-lab-page-state";

export default function StrategyLabPageClient() {
  const state = useStrategyLabPageState();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Strategy Lab</h1>
          <p className="text-sm text-muted-foreground">
            Backtest planner knobs using MarketOrderTradeDaily (MVP).
          </p>
        </div>
      </div>

      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="runs">
        <TabsList>
          <TabsTrigger value="runs">Runs</TabsTrigger>
          <TabsTrigger value="strategies">Strategies</TabsTrigger>
        </TabsList>

        <RunsTabContent {...state.runsTabProps} />
        <StrategiesTabContent {...state.strategiesTabProps} />
      </Tabs>
    </div>
  );
}
