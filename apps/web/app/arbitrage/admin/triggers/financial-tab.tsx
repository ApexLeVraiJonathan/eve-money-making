"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, RefreshCw, Calendar, FileCheck } from "lucide-react";
import type { TriggerState, CycleSnapshot } from "./types";

type FinancialTabProps = {
  loading: TriggerState;
  setLoading: React.Dispatch<React.SetStateAction<TriggerState>>;
  currentCycleId: string;
  snapshots: CycleSnapshot[];
  createSnapshot: () => Promise<void>;
};

export function FinancialTab({
  loading,
  setLoading,
  currentCycleId,
  snapshots,
  createSnapshot,
}: FinancialTabProps) {
  return (
    <TabsContent value="financial" className="space-y-6">
      {/* Wallet Import + Reconciliation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Wallet Import + Reconciliation
          </CardTitle>
          <CardDescription>
            Import wallet transactions for all LOGISTICS characters and
            automatically reconcile them with commit lines in the ledger
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-blue-500/10 p-4 space-y-2">
            <h3 className="text-sm font-medium">💡 What this does</h3>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Fetches latest wallet transactions from EVE ESI</li>
              <li>Matches transactions to commit lines (buy/sell orders)</li>
              <li>Creates ledger entries for matched transactions</li>
              <li>Helps track capital flow and commit execution status</li>
            </ul>
          </div>

          <Button
            onClick={async () => {
              setLoading((prev) => ({ ...prev, ["wallet-recon"]: true }));
              try {
                const res = await fetch("/api/jobs/wallets/run", {
                  method: "POST",
                });
                if (!res.ok) {
                  const error = await res
                    .json()
                    .catch(() => ({ error: "Unknown error" }));
                  throw new Error(error.error || res.statusText);
                }
                await res.json();
                toast.success(
                  "Wallet import and reconciliation completed successfully",
                );
              } catch (error) {
                const errorMessage =
                  error instanceof Error
                    ? error.message
                    : "Failed to run wallet import and reconciliation";
                toast.error(errorMessage);
              } finally {
                setLoading((prev) => ({
                  ...prev,
                  ["wallet-recon"]: false,
                }));
              }
            }}
            disabled={loading["wallet-recon"]}
            className="w-full"
          >
            {loading["wallet-recon"] ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Run Wallet Import + Reconciliation
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Standalone Reconciliation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Reconciliation Only
          </CardTitle>
          <CardDescription>
            Run reconciliation on existing wallet transactions without
            re-importing from ESI
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-amber-500/10 p-4 space-y-2">
            <h3 className="text-sm font-medium">📝 Note</h3>
            <p className="text-sm text-muted-foreground">
              Use this if wallet transactions are already imported and you just
              want to re-run the matching logic to ledger entries. Useful after
              fixing data issues or updating commit lines.
            </p>
          </div>

          <Button
            onClick={async () => {
              setLoading((prev) => ({ ...prev, ["reconcile-only"]: true }));
              try {
                const res = await fetch("/api/recon/reconcile", {
                  method: "POST",
                });
                if (!res.ok) {
                  const error = await res
                    .json()
                    .catch(() => ({ error: "Unknown error" }));
                  throw new Error(error.error || res.statusText);
                }
                const data = await res.json();
                toast.success(
                  `Reconciliation completed: ${data.created || 0} ledger entries created`,
                );
              } catch (error) {
                const errorMessage =
                  error instanceof Error
                    ? error.message
                    : "Failed to run reconciliation";
                toast.error(errorMessage);
              } finally {
                setLoading((prev) => ({
                  ...prev,
                  ["reconcile-only"]: false,
                }));
              }
            }}
            disabled={loading["reconcile-only"]}
            variant="secondary"
            className="w-full"
          >
            {loading["reconcile-only"] ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Reconciling...
              </>
            ) : (
              <>
                <FileCheck className="mr-2 h-4 w-4" />
                Run Reconciliation Only
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Cycle Snapshots */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Cycle Snapshots
          </CardTitle>
          <CardDescription>
            Capture point-in-time snapshots of the current cycle's financial
            state (cash, inventory, profit)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-blue-500/10 p-4 space-y-2">
            <h3 className="text-sm font-medium">📸 What this does</h3>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Records current wallet cash balance</li>
              <li>Calculates current inventory value (WAC-based)</li>
              <li>Captures current cycle profit</li>
              <li>Useful for tracking performance over time</li>
            </ul>
            {currentCycleId && (
              <p className="text-sm text-muted-foreground mt-2">
                <strong>Current cycle:</strong> {currentCycleId.slice(0, 8)}...
              </p>
            )}
          </div>

          <Button
            onClick={() => void createSnapshot()}
            disabled={loading["create-snapshot"] || !currentCycleId}
            className="w-full"
          >
            {loading["create-snapshot"] ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Snapshot...
              </>
            ) : (
              <>
                <Calendar className="mr-2 h-4 w-4" />
                Create Snapshot
              </>
            )}
          </Button>

          {/* Snapshots History */}
          {snapshots.length > 0 && (
            <div className="rounded-lg border overflow-hidden">
              <div className="p-3 border-b bg-muted/50">
                <h4 className="text-sm font-medium">
                  Recent Snapshots (Last 10)
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="p-2 text-left font-medium">Time</th>
                      <th className="p-2 text-right font-medium">Cash</th>
                      <th className="p-2 text-right font-medium">Inventory</th>
                      <th className="p-2 text-right font-medium">Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots.map((snapshot) => {
                      const cash = Number(snapshot.walletCashIsk);
                      const inventory = Number(snapshot.inventoryIsk);
                      const profit = Number(snapshot.cycleProfitIsk);

                      return (
                        <tr
                          key={snapshot.id}
                          className="border-b hover:bg-muted/50"
                        >
                          <td className="p-2">
                            {new Date(snapshot.snapshotAt).toLocaleString()}
                          </td>
                          <td className="p-2 text-right tabular-nums">
                            {(cash / 1_000_000).toFixed(1)}M
                          </td>
                          <td className="p-2 text-right tabular-nums">
                            {(inventory / 1_000_000).toFixed(1)}M
                          </td>
                          <td
                            className={`p-2 text-right tabular-nums ${
                              profit < 0 ? "text-red-400" : "text-emerald-500"
                            }`}
                          >
                            {(profit / 1_000_000).toFixed(1)}M
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}
