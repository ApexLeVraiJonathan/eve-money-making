import { Button } from "@eve/ui";
import { Textarea } from "@eve/ui";
import { Label } from "@eve/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@eve/ui";
import { Checkbox } from "@eve/ui";
import { Input } from "@eve/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eve/ui";
import { Calculator, CheckCircle2, FileText, Loader2 } from "lucide-react";

type Station = {
  id: string;
  stationId: number;
  station?: { name?: string | null } | null;
};

type Props = {
  useCommit: boolean;
  setUseCommit: (value: boolean) => void;
  cycleId: string;
  setCycleId: (value: string) => void;
  destinationId: number | null;
  setDestinationId: (value: number) => void;
  selfMarketStructureId: number | null;
  stations: Station[];
  paste: string;
  setPaste: (value: string) => void;
  onSubmit: () => void;
  isPending: boolean;
  isCnDestination: boolean;
};

export function SellAppraiserConfigCard({
  useCommit,
  setUseCommit,
  cycleId,
  setCycleId,
  destinationId,
  setDestinationId,
  selfMarketStructureId,
  stations,
  paste,
  setPaste,
  onSubmit,
  isPending,
  isCnDestination,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Configuration
        </CardTitle>
        <CardDescription>Configure items to appraise for selling</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Checkbox
            id="use-commit"
            checked={useCommit}
            onCheckedChange={(checked) => setUseCommit(checked === true)}
          />
          <Label htmlFor="use-commit" className="cursor-pointer">
            Use latest open cycle
          </Label>
        </div>

        {useCommit && (
          <div className="space-y-2">
            <Label>Cycle ID</Label>
            <Input
              value={cycleId}
              onChange={(e) => setCycleId(e.target.value)}
              placeholder="Enter cycle ID"
            />
          </div>
        )}

        {useCommit && cycleId && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 rounded-md bg-muted/50">
            <CheckCircle2 className="h-4 w-4" />
            Using cycle {cycleId.slice(0, 8)}…
          </div>
        )}

        {!useCommit && (
          <>
            <div className="space-y-2">
              <Label>Destination Station</Label>
              <Select
                value={destinationId?.toString() ?? ""}
                onValueChange={(value) => setDestinationId(Number(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a station" />
                </SelectTrigger>
                <SelectContent>
                  {selfMarketStructureId !== null && (
                    <SelectItem
                      key="self-market-cn"
                      value={selfMarketStructureId.toString()}
                    >
                      C-N (Structure)
                    </SelectItem>
                  )}
                  {stations
                    .filter(
                      (s) =>
                        selfMarketStructureId === null ||
                        s.stationId !== selfMarketStructureId,
                    )
                    .map((s) => (
                      <SelectItem key={s.id} value={s.stationId.toString()}>
                        {s.station?.name ?? s.stationId}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Paste Items</Label>
              <p className="text-xs text-muted-foreground">
                Format: itemName qty (one per line)
              </p>
              <Textarea
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                rows={8}
                placeholder="Damage Control II 10&#10;Gyrostabilizer II 5&#10;..."
                className="font-mono text-sm"
              />
            </div>
          </>
        )}

        <Button
          onClick={onSubmit}
          disabled={isPending || (useCommit ? !cycleId : !destinationId)}
          className="gap-2"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Computing...
            </>
          ) : (
            <>
              <Calculator className="h-4 w-4" />
              Appraise
            </>
          )}
        </Button>
        {isCnDestination && isPending ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Fetching C-N market data…
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
