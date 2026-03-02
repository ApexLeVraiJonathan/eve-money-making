import { Input } from "@eve/ui/input";
import { Label } from "@eve/ui/label";

type NumberInputProps = {
  id: string;
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  help?: string;
  step?: number;
};

export function NumberInput({
  id,
  label,
  value,
  onChange,
  help,
  step,
}: NumberInputProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        step={step}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      />
      {help && <p className="text-xs text-foreground/80">{help}</p>}
    </div>
  );
}
