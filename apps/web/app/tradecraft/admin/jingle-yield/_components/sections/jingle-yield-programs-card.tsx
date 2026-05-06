import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eve/ui";
import { Users } from "lucide-react";
import { formatIsk } from "@/lib/utils";
import { humanizeStatus } from "../lib/status";

type Program = {
  id: string;
  userId: string;
  status: string;
  lockedPrincipalIsk: string;
  cumulativeInterestIsk: string;
  targetInterestIsk: string;
  cyclesCompleted: number;
  minCycles: number;
  startCycle?: { id: string; name: string | null } | null;
  completedCycle?: { closedAt: string | null } | null;
};

export function JingleYieldProgramsCard({
  statusFilter,
  setStatusFilter,
  filtered,
  userLabelMap,
}: {
  statusFilter: string | "all";
  setStatusFilter: (value: string | "all") => void;
  filtered: Program[];
  userLabelMap: Map<string, { primaryName: string; label: string }>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <CardTitle>All JingleYield Programs</CardTitle>
          <CardDescription>
            Track each user&apos;s seeded participation, progress toward 2B interest,
            and completion state.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
          <span className="text-sm font-medium text-foreground">Filter:</span>
          <Select
            value={statusFilter}
            onValueChange={(val) => setStatusFilter(val as string | "all")}
          >
            <SelectTrigger className="w-[200px] h-8 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Programs</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="COMPLETED_CONTINUING">Completed (Continuing)</SelectItem>
              <SelectItem value="COMPLETED_CLOSED_LOSS">Completed (Closed)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                <Users className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">No programs found</h3>
              <p className="mb-4 mt-2 text-sm text-muted-foreground">
                {statusFilter === "all"
                  ? "No JingleYield programs have been created yet."
                  : `No programs match the "${humanizeStatus(statusFilter)}" filter. Try selecting a different status.`}
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">User</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium hidden md:table-cell">Locked</th>
                  <th className="text-right p-3 font-medium">Interest</th>
                  <th className="text-right p-3 font-medium hidden sm:table-cell">Progress</th>
                  <th className="text-left p-3 font-medium hidden lg:table-cell">Cycles</th>
                  <th className="text-left p-3 font-medium hidden xl:table-cell">Start Cycle</th>
                  <th className="text-left p-3 font-medium hidden lg:table-cell">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((p) => {
                  const interest = parseFloat(p.cumulativeInterestIsk);
                  const target = parseFloat(p.targetInterestIsk) || 1;
                  const pct = Math.min(100, Math.max(0, (interest / target) * 100));
                  const userInfo = userLabelMap.get(p.userId);

                  return (
                    <tr key={p.id} className="hover:bg-muted/50">
                      <td className="p-3 text-sm">
                        <div className="font-medium">
                          {userInfo?.primaryName ?? p.userId.substring(0, 8)}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {p.userId.substring(0, 8)}…
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge
                          variant="outline"
                          className={
                            p.status === "ACTIVE"
                              ? "bg-emerald-500/10 text-emerald-600"
                              : p.status === "COMPLETED_CONTINUING"
                                ? "bg-blue-500/10 text-blue-600"
                                : "bg-red-500/10 text-red-600"
                          }
                        >
                          {humanizeStatus(p.status)}
                        </Badge>
                      </td>
                      <td className="p-3 text-right font-mono text-xs hidden md:table-cell">
                        {formatIsk(parseFloat(p.lockedPrincipalIsk))}
                      </td>
                      <td className="p-3 text-right font-mono text-xs">
                        {formatIsk(interest)}
                      </td>
                      <td className="p-3 text-right text-xs hidden sm:table-cell">
                        {pct.toFixed(1)}%
                      </td>
                      <td className="p-3 text-xs text-muted-foreground hidden lg:table-cell">
                        {p.cyclesCompleted} / {p.minCycles}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground hidden xl:table-cell">
                        {p.startCycle ? `${p.startCycle.name ?? p.startCycle.id.substring(0, 8)}` : "—"}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground hidden lg:table-cell">
                        {p.completedCycle
                          ? p.completedCycle.closedAt
                            ? new Date(p.completedCycle.closedAt).toLocaleDateString()
                            : "In progress"
                          : "Not yet"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
