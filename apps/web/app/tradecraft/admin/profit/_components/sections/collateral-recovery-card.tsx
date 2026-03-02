import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@eve/ui";
import { DollarSign, Plus } from "lucide-react";
import { formatIsk } from "@/lib/utils";
import type { CycleProfitBreakdown } from "@eve/shared/tradecraft-cycles";

type Props = {
  collateralAmount: string;
  setCollateralAmount: (value: string) => void;
  collateralMemo: string;
  setCollateralMemo: (value: string) => void;
  isPending: boolean;
  onSubmit: () => void;
  successMessage: string;
  breakdown: CycleProfitBreakdown;
};

export function CollateralRecoveryCard({
  collateralAmount,
  setCollateralAmount,
  collateralMemo,
  setCollateralMemo,
  isPending,
  onSubmit,
  successMessage,
  breakdown,
}: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Add Collateral Recovery (Manual)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 max-w-2xl">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="collateral-amount">Profit Amount (ISK)</Label>
              <Input
                id="collateral-amount"
                type="number"
                placeholder="0.00"
                value={collateralAmount}
                onChange={(e) => setCollateralAmount(e.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="collateral-memo">Memo (optional)</Label>
              <Input
                id="collateral-memo"
                type="text"
                placeholder="e.g., Collateral profit for failed package"
                value={collateralMemo}
                onChange={(e) => setCollateralMemo(e.target.value)}
                disabled={isPending}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={onSubmit}
              disabled={!collateralAmount || isPending}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Collateral Recovery
            </Button>
            {successMessage && (
              <span className="text-sm text-emerald-600 font-medium">{successMessage}</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Total collateral recovery recorded:{" "}
            <span className="font-medium tabular-nums">
              {Number(breakdown.expenses.collateralRecovery) < 0
                ? formatIsk(Math.abs(Number(breakdown.expenses.collateralRecovery)))
                : "0.00"}
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
