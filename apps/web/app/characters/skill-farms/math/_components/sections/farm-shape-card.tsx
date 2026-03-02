import { Button } from "@eve/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@eve/ui/card";
import { Checkbox } from "@eve/ui/checkbox";
import { clampNonNegativeInt, type SkillFarmDerived } from "../lib/math";
import { NumberInput } from "./number-input";

type FarmShapeCardProps = {
  totalCharacters: number;
  setTotalCharacters: (v: number) => void;
  omegaRequired: number;
  setOmegaRequired: (v: number) => void;
  mctRequired: number;
  setMctRequired: (v: number) => void;
  spPerMinute: number;
  setSpPerMinute: (v: number) => void;
  autoRecalc: boolean;
  setAutoRecalc: (v: boolean) => void;
  onRecalculate: () => void;
  isCalculating: boolean;
  derived: SkillFarmDerived;
};

export function FarmShapeCard({
  totalCharacters,
  setTotalCharacters,
  omegaRequired,
  setOmegaRequired,
  mctRequired,
  setMctRequired,
  spPerMinute,
  setSpPerMinute,
  autoRecalc,
  setAutoRecalc,
  onRecalculate,
  isCalculating,
  derived,
}: FarmShapeCardProps) {
  return (
    <Card className="bg-gradient-to-b from-background to-muted/5">
      <CardHeader>
        <CardTitle className="text-base">Farm shape</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <NumberInput
            id="totalCharacters"
            label="Number of characters"
            value={totalCharacters}
            onChange={(v) => setTotalCharacters(v ?? 0)}
            step={1}
          />
          <NumberInput
            id="omegaRequired"
            label="Number of Omega required"
            value={omegaRequired}
            onChange={(v) => setOmegaRequired(v ?? 0)}
            help="How many 30-day Omega subscriptions your farm consumes."
            step={1}
          />
          <NumberInput
            id="spPerMinute"
            label="SP per minute per character"
            value={spPerMinute}
            onChange={(v) => setSpPerMinute(v ?? 0)}
            help="Use your actual training speed (attributes + implants + boosters). Example: 63 SP/min."
            step={0.1}
          />
          <NumberInput
            id="mctRequired"
            label="Number of MCT required"
            value={mctRequired}
            onChange={(v) => setMctRequired(v ?? 0)}
            help="How many 30-day MCT subscriptions your farm consumes."
            step={1}
          />
          <div className="rounded-md border bg-background/40 p-3">
            <div className="text-xs text-foreground/80">Characters total</div>
            <div className="mt-1 text-sm font-medium text-foreground">
              {derived.totalCharacters.toLocaleString()}
            </div>
            <div className="mt-1 text-xs text-foreground/70">
              Using {clampNonNegativeInt(omegaRequired)} Omega and{" "}
              {clampNonNegativeInt(mctRequired)} MCT
            </div>
          </div>
          <div className="rounded-md border bg-background/40 p-3">
            <div className="text-xs text-foreground/80">Time per injector (500k SP)</div>
            <div className="mt-1 text-sm font-medium text-foreground">
              {derived.daysPerInjector > 0 ? `${derived.daysPerInjector.toFixed(2)} days` : "—"}
            </div>
            <div className="mt-1 text-xs text-foreground/70">
              {derived.injectorsPer30Days > 0
                ? `${derived.injectorsPer30Days.toFixed(2)} injectors / 30d per character`
                : "Set SP/min to compute"}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-sm text-foreground/80">
            <Checkbox
              id="autoRecalc"
              checked={autoRecalc}
              onCheckedChange={(v) => setAutoRecalc(!!v)}
            />
            Auto recalculate
          </label>

          <Button
            onClick={onRecalculate}
            disabled={isCalculating}
            variant={autoRecalc ? "outline" : "default"}
          >
            {isCalculating ? "Calculating…" : "Recalculate now"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
