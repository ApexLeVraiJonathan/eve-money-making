import { Button } from "@eve/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@eve/ui";
import { CheckCircle2, Store } from "lucide-react";
import { UndercutResultsTable } from "../../undercut-results-table";
import type { UndercutCheckGroup } from "@eve/shared/tradecraft-pricing";
import type { SelectionStore } from "../lib/selection-store";
import type { GroupToRender } from "../lib/types";

export function UndercutResultsSection({
  result,
  groupsToRender,
  onConfirmReprice,
  canConfirm,
  selectionStore,
  copiedKey,
  onCopyPrice,
  relistPct,
}: {
  result: UndercutCheckGroup[] | null;
  groupsToRender: GroupToRender[];
  onConfirmReprice: () => void;
  canConfirm: boolean;
  selectionStore: SelectionStore;
  copiedKey: string | null;
  onCopyPrice: (price: number, key: string) => void;
  relistPct: number;
}) {
  if (!Array.isArray(result) || result.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Undercut Results</h2>
        <Button onClick={onConfirmReprice} disabled={!canConfirm} className="gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Confirm Repriced
        </Button>
      </div>

      {groupsToRender.map(({ group, updates: visibleUpdates }, gi) => (
        <Card key={gi}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              {group.characterName ?? `Character ${group.characterId}`}
            </CardTitle>
            <CardDescription>
              {group.stationName ?? `Station ${group.stationId}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UndercutResultsTable
              group={group}
              updates={visibleUpdates}
              selectionStore={selectionStore}
              copiedKey={copiedKey}
              onCopyPrice={onCopyPrice}
              relistPct={relistPct}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
