import { Button, Input, Label } from "@eve/ui";
import {
  HUBS,
  STRATEGIES,
  type Hub,
  type Strategy,
} from "../lib/consignment-form-utils";

type ConsignmentConfigPanelProps = {
  title: string;
  onTitleChange: (value: string) => void;
  hub: Hub;
  onHubChange: (hub: Hub) => void;
  strategy: Strategy;
  onStrategyChange: (strategy: Strategy) => void;
  itemCount: number;
  onImportClick: () => void;
  onClearItemsClick: () => void;
};

export function ConsignmentConfigPanel({
  title,
  onTitleChange,
  hub,
  onHubChange,
  strategy,
  onStrategyChange,
  itemCount,
  onImportClick,
  onClearItemsClick,
}: ConsignmentConfigPanelProps) {
  return (
    <div className="grid self-start gap-4 rounded-md border p-4 surface-1 md:col-span-1">
      <div className="grid gap-2 text-sm">
        <div className="flex items-center justify-between gap-2">
          <Label className="mb-0">Title</Label>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onImportClick}>
              Import Item List
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onClearItemsClick}
              disabled={itemCount === 0}
            >
              Clear items
            </Button>
          </div>
        </div>
        <Input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="e.g. Cruiser fits batch"
        />
      </div>

      <div className="grid gap-1 text-sm">
        <Label>Hub</Label>
        <select
          className="h-9 rounded-md border bg-transparent px-3"
          value={hub}
          onChange={(e) => onHubChange(e.target.value as Hub)}
        >
          {HUBS.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-2 text-sm">
        <Label>Listing strategy</Label>
        <ul className="grid gap-2">
          {STRATEGIES.map((s) => {
            const checked = strategy.code === s.code;
            return (
              <li
                key={s.code}
                className={`rounded-md border p-2 ${checked ? "ring-2 ring-primary" : ""}`}
              >
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="radio"
                    name="strategy"
                    checked={checked}
                    onChange={() => onStrategyChange(s)}
                    className="mt-1 accent-yellow-500"
                  />
                  <span className="flex flex-col text-left">
                    <span className="font-medium text-foreground/90">
                      {s.label} — Fee {s.fee}% (Code {s.code})
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {s.help}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
