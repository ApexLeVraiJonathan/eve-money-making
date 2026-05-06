import {
  Alert,
  AlertDescription,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@eve/ui";
import { AlertCircle } from "lucide-react";
import type {
  CycleSettlementReport,
  CycleSettlementStepReport,
  CycleSettlementStepStatus,
} from "@eve/shared/tradecraft-cycles";

type SettlementReportPanelProps = {
  report: CycleSettlementReport | null;
  title: string;
};

const stepLabels: Record<CycleSettlementStepReport["name"], string> = {
  wallet_import: "Wallet Import",
  transaction_allocation: "Transaction Allocation",
  rollover_buyback: "Cycle Rollover Buyback",
  close_previous_cycle: "Close Previous Cycle",
  payout_creation: "Payout Creation",
  cycle_rollover: "Cycle Rollover",
};

const statusVariants: Record<
  CycleSettlementStepStatus,
  "default" | "secondary" | "outline"
> = {
  succeeded: "default",
  failed: "outline",
  skipped: "secondary",
};

const statusClasses: Partial<Record<CycleSettlementStepStatus, string>> = {
  failed: "border-destructive text-destructive",
};

function formatCycleId(cycleId: string | null) {
  return cycleId ?? "No Open Cycle Period";
}

function formatDuration(durationMs?: number) {
  return typeof durationMs === "number" ? `${durationMs}ms` : "-";
}

function formatStepKind(step: CycleSettlementStepReport) {
  return step.kind === "strict" ? "Strict Settlement Step" : "Recoverable Settlement Step";
}

export function SettlementReportPanel({ report, title }: SettlementReportPanelProps) {
  if (!report) return null;

  const hasRecoverableFailures = report.recoverableFailures.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Settlement Report</CardTitle>
        <div className="text-sm text-muted-foreground">
          Last Cycle Lifecycle Entry Point: {title}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border p-3">
            <div className="text-xs font-medium uppercase text-muted-foreground">
              Settled cycle
            </div>
            <div className="mt-1 break-all font-mono text-sm">
              {formatCycleId(report.settledCycleId)}
            </div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-xs font-medium uppercase text-muted-foreground">
              Target cycle
            </div>
            <div className="mt-1 break-all font-mono text-sm">
              {formatCycleId(report.targetCycleId)}
            </div>
          </div>
        </div>

        {hasRecoverableFailures ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="font-medium">
                Recoverable Settlement Step failures need admin review.
              </div>
              <div className="mt-2 space-y-1">
                {report.recoverableFailures.map((step) => (
                  <div key={step.name}>
                    {stepLabels[step.name]}: {step.message ?? "Failed without a message."}
                  </div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-foreground">Step</TableHead>
                <TableHead className="text-foreground">Type</TableHead>
                <TableHead className="text-foreground">Status</TableHead>
                <TableHead className="text-foreground">Duration</TableHead>
                <TableHead className="text-foreground">Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.steps.map((step) => (
                <TableRow key={step.name}>
                  <TableCell className="font-medium">{stepLabels[step.name]}</TableCell>
                  <TableCell>{formatStepKind(step)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={statusVariants[step.status]}
                      className={statusClasses[step.status]}
                    >
                      {step.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDuration(step.durationMs)}</TableCell>
                  <TableCell className="max-w-md">
                    <span className="text-sm text-muted-foreground">
                      {step.message ?? "-"}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
