import { Checkbox } from "@eve/ui";
import type { NotificationPreferenceDto } from "@/app/tradecraft/api/notifications.hooks";

type PreferenceRowProps = {
  title: string;
  description: string;
  pref: NotificationPreferenceDto | undefined;
  onChange: (pref: NotificationPreferenceDto, enabled: boolean) => void;
};

export function PreferenceRow({
  title,
  description,
  pref,
  onChange,
}: PreferenceRowProps) {
  if (!pref) return null;

  return (
    <label className="flex w-full cursor-pointer items-start justify-between gap-4 rounded-lg p-2 pl-7 text-left transition-colors hover:bg-muted/40">
      <div className="space-y-0.5">
        <div className="text-sm font-semibold leading-tight">{title}</div>
        <p className="text-xs leading-snug text-foreground/80">{description}</p>
      </div>
      <Checkbox
        checked={pref.enabled}
        onCheckedChange={(value) => onChange(pref, Boolean(value))}
        className="mt-0.5 h-5 w-5 transition-all duration-200"
      />
    </label>
  );
}
