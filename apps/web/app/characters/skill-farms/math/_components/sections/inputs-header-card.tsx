import { Card, CardHeader, CardTitle } from "@eve/ui/card";
import { Button } from "@eve/ui/button";

type InputsHeaderCardProps = {
  isSaving: boolean;
  onReset: () => void;
  onSaveDefaults: () => void;
};

export function InputsHeaderCard({
  isSaving,
  onReset,
  onSaveDefaults,
}: InputsHeaderCardProps) {
  return (
    <Card className="bg-gradient-to-b from-background to-muted/5">
      <CardHeader className="gap-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Inputs</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={onReset}>
              Reset
            </Button>
            <Button size="sm" disabled={isSaving} onClick={onSaveDefaults}>
              Save defaults
            </Button>
          </div>
        </div>
        <p className="text-sm text-foreground/80">
          Adjust your assumptions below. The results panel calculates profit and
          shows a line-by-line breakdown for your farm.
        </p>
      </CardHeader>
    </Card>
  );
}
