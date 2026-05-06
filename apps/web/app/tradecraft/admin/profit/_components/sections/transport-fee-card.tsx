import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@eve/ui";
import { Plus, Truck } from "lucide-react";
import { formatIsk } from "@/lib/utils";
import type { CycleProfitBreakdown } from "@eve/shared/tradecraft-cycles";

type Props = {
  transportAmount: string;
  setTransportAmount: (value: string) => void;
  transportMemo: string;
  setTransportMemo: (value: string) => void;
  isPending: boolean;
  onSubmit: () => void;
  successMessage: string;
  breakdown: CycleProfitBreakdown;
};

export function TransportFeeCard({
  transportAmount,
  setTransportAmount,
  transportMemo,
  setTransportMemo,
  isPending,
  onSubmit,
  successMessage,
  breakdown,
}: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Add Shipping / Transport Cost
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 max-w-2xl">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="transport-amount">Amount (ISK)</Label>
              <Input
                id="transport-amount"
                type="number"
                placeholder="0.00"
                value={transportAmount}
                onChange={(e) => setTransportAmount(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="transport-memo">Memo (optional)</Label>
              <Input
                id="transport-memo"
                type="text"
                placeholder="e.g., Jita to Amarr"
                value={transportMemo}
                onChange={(e) => setTransportMemo(e.target.value)}
                disabled={isPending}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={onSubmit}
              disabled={!transportAmount || isPending}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Shipping Cost
            </Button>
            {successMessage && (
              <span className="text-sm text-emerald-600 font-medium">{successMessage}</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Total recorded transport fees:{" "}
            <span className="font-medium tabular-nums">
              {formatIsk(Number(breakdown.expenses.transportFees))}
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
