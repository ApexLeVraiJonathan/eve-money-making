import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox, Label, Separator } from "@eve/ui";
import { Users } from "lucide-react";
import {
  formatIsk,
  formatIskFromNumber,
  getParticipationType,
  getParticipationTypeBadge,
  getStatusBadge,
} from "../lib/formatting";
import type { CycleGroup } from "../lib/types";

export function ParticipantsOverviewCard({
  participationsCount,
  cycles,
  visibleCycleIds,
  showPastCycles,
  setShowPastCycles,
}: {
  participationsCount: number;
  cycles: CycleGroup[];
  visibleCycleIds: Set<string>;
  showPastCycles: boolean;
  setShowPastCycles: (value: boolean) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              All Participants
            </CardTitle>
            <CardDescription>
              Current participation status grouped by cycle ({participationsCount} total)
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => (window.location.href = "/tradecraft/admin/users")}
            >
              Manage user caps
            </Button>
            <div className="flex items-center gap-2">
              <Checkbox
                id="showPastCycles"
                checked={showPastCycles}
                onCheckedChange={(v) => setShowPastCycles(Boolean(v))}
              />
              <Label htmlFor="showPastCycles" className="text-xs text-muted-foreground">
                Show past cycles
              </Label>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {participationsCount === 0 ? (
          <div className="rounded-lg border p-8 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-sm font-medium mb-1">No participations yet</h3>
            <p className="text-sm text-muted-foreground">
              Participations will appear here once users opt in to cycles
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {cycles
              .filter((c) => showPastCycles || visibleCycleIds.has(c.cycleId))
              .map((c) => {
                const totalIsk = c.participations.reduce(
                  (sum, p) => sum + Number(p.amountIsk),
                  0,
                );

                const statusBadge =
                  c.cycleStatus === "OPEN" ? (
                    <Badge className="bg-emerald-500/10 text-emerald-600">Open</Badge>
                  ) : c.cycleStatus === "PLANNED" ? (
                    <Badge className="bg-amber-500/10 text-amber-600">Planned</Badge>
                  ) : c.cycleStatus === "COMPLETED" ? (
                    <Badge className="bg-slate-500/10 text-slate-600">Completed</Badge>
                  ) : (
                    <Badge variant="outline">{c.cycleStatus}</Badge>
                  );

                return (
                  <div key={c.cycleId} className="rounded-lg border">
                    <div className="flex flex-col gap-2 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <div className="font-medium">
                              {c.cycleName ?? `Cycle ${c.cycleId.substring(0, 8)}`}
                            </div>
                            {statusBadge}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {c.startedAt
                              ? `Starts: ${new Date(c.startedAt).toLocaleString()}`
                              : `ID: ${c.cycleId}`}
                            {c.closedAt
                              ? ` • Closed: ${new Date(c.closedAt).toLocaleString()}`
                              : null}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <div className="tabular-nums">
                            <span className="font-medium text-foreground">
                              {c.participations.length}
                            </span>{" "}
                            participants
                          </div>
                          <div className="tabular-nums">
                            <span className="font-medium text-foreground">
                              {formatIskFromNumber(totalIsk)}
                            </span>{" "}
                            ISK
                          </div>
                        </div>
                      </div>
                    </div>
                    <Separator />
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left p-3 font-medium">Character</th>
                            <th className="text-left p-3 font-medium">Type</th>
                            <th className="text-right p-3 font-medium">Amount</th>
                            <th className="text-left p-3 font-medium">Status</th>
                            <th className="text-left p-3 font-medium">Payment</th>
                            <th className="text-left p-3 font-medium">Created</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {c.participations.map((p) => (
                            <tr
                              key={p.id}
                              className="hover:bg-muted/50 transition-colors"
                              title={getParticipationType(p)}
                            >
                              <td className="p-3 font-medium">{p.characterName}</td>
                              <td className="p-3">{getParticipationTypeBadge(p)}</td>
                              <td className="p-3 text-right font-mono text-xs">
                                {formatIsk(p.amountIsk)} ISK
                              </td>
                              <td className="p-3">{getStatusBadge(p.status)}</td>
                              <td className="p-3">
                                {p.walletJournalId ? (
                                  <Badge
                                    variant="outline"
                                    className="bg-green-500/10 text-green-600 text-xs"
                                  >
                                    Linked
                                  </Badge>
                                ) : p.status === "AWAITING_INVESTMENT" ? (
                                  <Badge
                                    variant="outline"
                                    className="bg-amber-500/10 text-amber-600 text-xs"
                                  >
                                    Pending
                                  </Badge>
                                ) : p.status === "OPTED_OUT" && !p.refundedAt ? (
                                  <Badge
                                    variant="outline"
                                    className="bg-red-500/10 text-red-600 text-xs"
                                  >
                                    Needs Refund
                                  </Badge>
                                ) : null}
                              </td>
                              <td className="p-3 text-xs text-muted-foreground">
                                {new Date(p.createdAt).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}

            {!showPastCycles && cycles.length > visibleCycleIds.size ? (
              <div className="text-xs text-muted-foreground">
                Showing current/planned cycles. Enable “Show past cycles” to browse older
                participations.
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
