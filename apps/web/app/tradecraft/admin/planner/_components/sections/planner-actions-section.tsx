import { Check, Loader2, Package } from "lucide-react";
import { Button, Input } from "@eve/ui";

type PlannerActionsSectionProps = {
  loading: boolean;
  hasData: boolean;
  memo: string;
  setMemo: (value: string) => void;
  commitPending: boolean;
  suggestedShipping: number | null;
  suggestedShippingMemo: string;
  onGeneratePlan: () => void;
  onOpenCommitDialog: (opts: {
    recordShipping: boolean;
    shippingAmount: string;
    shippingMemo: string;
  }) => void;
};

export function PlannerActionsSection({
  loading,
  hasData,
  memo,
  setMemo,
  commitPending,
  suggestedShipping,
  suggestedShippingMemo,
  onGeneratePlan,
  onOpenCommitDialog,
}: PlannerActionsSectionProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <Button
        onClick={onGeneratePlan}
        disabled={loading}
        className="flex-1 gap-2 sm:flex-initial"
        size="lg"
      >
        {loading ? (
          "Planning..."
        ) : (
          <>
            <Package className="h-4 w-4" />
            Generate Plan
          </>
        )}
      </Button>

      {hasData && (
        <div className="flex flex-1 gap-2">
          <Input
            placeholder="Commit memo (optional)"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
          <Button
            variant="secondary"
            disabled={!hasData || commitPending}
            onClick={() => {
              const suggested = suggestedShipping ?? 0;
              onOpenCommitDialog({
                recordShipping: true,
                shippingAmount: suggested > 0 ? suggested.toFixed(2) : "",
                shippingMemo: suggestedShippingMemo,
              });
            }}
            className="gap-2"
          >
            {commitPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Committing...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Commit Plan
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
