"use client";

import * as React from "react";
import { Button } from "@eve/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@eve/ui";
import { TabsContent } from "@eve/ui";
import { toast } from "sonner";
import { Loader2, Download, PlayCircle } from "lucide-react";
import type { TriggerState, MatchResult } from "./types";
import { useImportWallet } from "../../api";

type ParticipationsTabProps = {
  loading: TriggerState;
  matchResult: MatchResult | null;
  matchParticipationPayments: (cycleId?: string) => Promise<void>;
};

export function ParticipationsTab({
  loading,
  matchResult,
  matchParticipationPayments,
}: ParticipationsTabProps) {
  const importWalletMutation = useImportWallet();

  return (
    <TabsContent value="participations" className="space-y-6">
      {/* Wallet Journal Import */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Import Wallet Journals
          </CardTitle>
          <CardDescription>
            Import wallet journals for all LOGISTICS characters to get latest
            donations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            <h3 className="text-sm font-medium">📝 Note</h3>
            <p className="text-sm text-muted-foreground">
              Run this before matching payments to ensure you have the latest
              wallet data from all LOGISTICS characters.
            </p>
          </div>

          <Button
            onClick={async () => {
              try {
                const data = await importWalletMutation.mutateAsync();
                toast.success(
                  `Wallet journals imported: ${data.imported} imported, ${data.skipped} skipped (${data.charactersProcessed} characters)`,
                );
              } catch (error) {
                const errorMessage =
                  error instanceof Error
                    ? error.message
                    : "Failed to import wallet journals";
                toast.error(errorMessage);
              }
            }}
            disabled={importWalletMutation.isPending}
            className="gap-2 w-full sm:w-auto"
          >
            {importWalletMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Import All Wallets
          </Button>
        </CardContent>
      </Card>

      {/* Match Payments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlayCircle className="h-5 w-5" />
            Match Participation Payments
          </CardTitle>
          <CardDescription>
            Automatically match wallet donations to pending participations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            <h3 className="text-sm font-medium">How it works</h3>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>
                Matches player donations to AWAITING_INVESTMENT participations
              </li>
              <li>
                Supports fuzzy matching for typos in memos (up to 3 characters)
              </li>
              <li>Handles multiple payments with same memo (sums them)</li>
              <li>Updates investment amount if partial/over payment</li>
              <li>Links to actual payer character for payouts</li>
            </ul>
          </div>

          <Button
            onClick={() => void matchParticipationPayments()}
            disabled={loading["match-payments"]}
            className="gap-2 w-full sm:w-auto"
          >
            {loading["match-payments"] ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PlayCircle className="h-4 w-4" />
            )}
            Match All Payments
          </Button>

          {/* Match Results */}
          {matchResult && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/50 p-4">
                <h3 className="text-sm font-medium mb-3">Match Results</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Total Matched</div>
                    <div className="text-2xl font-bold text-emerald-600">
                      {matchResult.matched}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Amount Adjusted</div>
                    <div className="text-2xl font-bold text-amber-600">
                      {matchResult.partial}
                    </div>
                  </div>
                </div>
              </div>

              {/* Unmatched Payments */}
              {matchResult.unmatched.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">
                    Unmatched Payments ({matchResult.unmatched.length})
                  </h3>
                  <div className="rounded-lg border">
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b bg-muted/50 sticky top-0">
                          <tr>
                            <th className="text-left p-2 font-medium">Date</th>
                            <th className="text-left p-2 font-medium">
                              Character ID
                            </th>
                            <th className="text-right p-2 font-medium">
                              Amount (ISK)
                            </th>
                            <th className="text-left p-2 font-medium">Memo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {matchResult.unmatched.map((u, idx) => (
                            <tr
                              key={`${u.characterId}-${u.journalId}-${idx}`}
                              className="border-b last:border-0 hover:bg-muted/50"
                            >
                              <td className="p-2 font-mono text-xs">
                                {new Date(u.date).toLocaleDateString()}
                              </td>
                              <td className="p-2 font-mono text-xs">
                                {u.characterId}
                              </td>
                              <td className="p-2 text-right font-mono text-xs">
                                {Number(u.amount).toLocaleString()}
                              </td>
                              <td className="p-2 font-mono text-xs truncate max-w-xs">
                                {u.description || (
                                  <span className="text-muted-foreground italic">
                                    No memo
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}
