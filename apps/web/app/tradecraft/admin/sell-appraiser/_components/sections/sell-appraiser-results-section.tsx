import { Button } from "@eve/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@eve/ui";
import { CheckCircle2, Loader2, Store } from "lucide-react";
import { SellAppraiserResultsTable } from "../../sell-appraiser-results-table";
import type { GroupedResult } from "../lib/row-types";
import type { SelectionStore } from "../lib/selection-store";

type Props = {
  groupedResults: GroupedResult[];
  useCommit: boolean;
  onConfirmListed: () => void;
  isConfirming: boolean;
  cycleId: string;
  selectionStore: SelectionStore;
  copiedKey: string | null;
  onCopySuggestedPrice: (price: number, key: string) => void;
  brokerFeePct: number;
};

export function SellAppraiserResultsSection({
  groupedResults,
  useCommit,
  onConfirmListed,
  isConfirming,
  cycleId,
  selectionStore,
  copiedKey,
  onCopySuggestedPrice,
  brokerFeePct,
}: Props) {
  if (groupedResults.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Appraisal Results</h2>
        {useCommit && (
          <Button
            onClick={onConfirmListed}
            disabled={isConfirming || !cycleId}
            className="gap-2"
          >
            {isConfirming ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Confirming...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Confirm Listed
              </>
            )}
          </Button>
        )}
      </div>

      {groupedResults.map((group, gi) => (
        <Card key={gi}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              {group.stationName}
            </CardTitle>
            <CardDescription>
              {group.items.length} item{group.items.length !== 1 ? "s" : ""} ready to
              list
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SellAppraiserResultsTable
              items={group.items}
              selectionStore={selectionStore}
              copiedKey={copiedKey}
              onCopySuggestedPrice={onCopySuggestedPrice}
              isCommitMode={useCommit}
              brokerFeePct={brokerFeePct}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
