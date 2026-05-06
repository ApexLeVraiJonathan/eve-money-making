import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from "@eve/ui";
import { AlertCircle, Loader2, PackageX } from "lucide-react";
import { formatIsk } from "@/lib/utils";
import type { PackageDetails } from "../lib/types";

export function MarkFailedDialog({
  selectedPackage,
  showFailedDialog,
  setShowFailedDialog,
  collateralRecovered,
  setCollateralRecovered,
  collateralProfit,
  setCollateralProfit,
  failureMemo,
  setFailureMemo,
  totalItemCosts,
  isSubmitting,
  onSubmit,
}: {
  selectedPackage: PackageDetails | null;
  showFailedDialog: boolean;
  setShowFailedDialog: (value: boolean) => void;
  collateralRecovered: string;
  setCollateralRecovered: (value: string) => void;
  collateralProfit: string;
  setCollateralProfit: (value: string) => void;
  failureMemo: string;
  setFailureMemo: (value: string) => void;
  totalItemCosts: number;
  isSubmitting: boolean;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={showFailedDialog} onOpenChange={setShowFailedDialog}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mark Package as Failed</DialogTitle>
          <DialogDescription>
            Package #{selectedPackage?.packageIndex} to {selectedPackage?.destinationName}
          </DialogDescription>
        </DialogHeader>

        {selectedPackage && (
          <div className="space-y-4">
            {selectedPackage.validationMessage && (
              <Alert variant={selectedPackage.canMarkFailed ? "default" : "destructive"}>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{selectedPackage.validationMessage}</AlertDescription>
              </Alert>
            )}

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This will reduce quantities and costs for all linked cycle lines. This
                action cannot be undone.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Items in Package</Label>
              <div className="border rounded-md max-h-48 overflow-y-auto">
                <div className="divide-y">
                  {selectedPackage.items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-2 text-sm">
                      <span>{item.typeName}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {item.units.toLocaleString()} units
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Linked Cycle Lines</Label>
              <div className="border rounded-md max-h-48 overflow-y-auto text-xs">
                <div className="divide-y">
                  {selectedPackage.linkedCycleLines.map((link) => (
                    <div key={link.cycleLineId} className="flex flex-col gap-1 p-2">
                      <div className="flex justify-between">
                        <span className="font-medium">{link.typeName ?? `Type ${link.typeId}`}</span>
                        <span className="text-muted-foreground">
                          Will mark {link.lostUnitsCandidate.toLocaleString()} as lost
                        </span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Committed: {link.unitsCommitted.toLocaleString()}</span>
                        <span>
                          Bought: {link.unitsBought.toLocaleString()} / Sold:{" "}
                          {link.unitsSold.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">Item Costs</Label>
              <div className="p-3 bg-muted/30 rounded-md border">
                <p className="text-sm font-medium tabular-nums">{formatIsk(totalItemCosts)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Capital automatically recovered by reducing cycle lines
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="collateralRecovered">Collateral Recovered (ISK)</Label>
              <Input
                id="collateralRecovered"
                type="text"
                value={collateralRecovered}
                onChange={(e) => setCollateralRecovered(e.target.value)}
                placeholder="e.g. 1234567.89"
              />
              <p className="text-xs text-muted-foreground">
                Original collateral: {formatIsk(Number(selectedPackage.collateralIsk))}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="collateralProfit">Collateral Profit / Margin (ISK)</Label>
              <Input
                id="collateralProfit"
                type="text"
                value={collateralProfit}
                onChange={(e) => setCollateralProfit(e.target.value)}
                placeholder="Optional - leave blank to auto-calculate"
              />
              {!collateralProfit && collateralRecovered && (
                <p className="text-xs text-muted-foreground">
                  Auto-calculated profit:{" "}
                  <span className="font-medium">
                    {formatIsk(Math.max(0, Number(collateralRecovered) - totalItemCosts))}
                  </span>
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Only the profit portion above item costs will be recorded as income
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="failureMemo">Memo (Optional)</Label>
              <Textarea
                id="failureMemo"
                value={failureMemo}
                onChange={(e) => setFailureMemo(e.target.value)}
                placeholder="Notes about the failed contract..."
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setShowFailedDialog(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onSubmit}
            disabled={!selectedPackage?.canMarkFailed || !collateralRecovered || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <PackageX className="h-4 w-4 mr-2" />
                Mark as Failed
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
