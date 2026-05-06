import { Button } from "@eve/ui";

type SubmitConsignmentBarProps = {
  canSubmit: boolean;
  onSubmitClick: () => void;
};

export function SubmitConsignmentBar({
  canSubmit,
  onSubmitClick,
}: SubmitConsignmentBarProps) {
  return (
    <div className="-mx-6 sticky bottom-0 z-10 border-t bg-background/80 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={onSubmitClick} disabled={!canSubmit}>
          Submit Consignment
        </Button>
        <span className="text-xs text-muted-foreground">
          Make sure title and items are filled before submitting.
        </span>
      </div>
    </div>
  );
}
