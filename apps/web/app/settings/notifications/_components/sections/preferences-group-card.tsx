import * as React from "react";
import { cn, Separator, Switch } from "@eve/ui";
import type { NotificationPreferenceDto } from "@/app/tradecraft/api/notifications.hooks";
import type { NotificationTypeKey, PrefItem } from "../lib/notification-types";
import { PreferenceRow } from "../ui/preference-row";

type Props = {
  title: string;
  subtitle: string;
  ariaLabel: string;
  types: readonly NotificationTypeKey[];
  items: PrefItem[];
  getGroupState: (types: readonly NotificationTypeKey[]) => boolean | "indeterminate";
  groupStatus: (state: boolean | "indeterminate") => {
    label: string;
    className: string;
  };
  toggleGroup: (
    types: readonly NotificationTypeKey[],
    value: boolean | "indeterminate",
  ) => void;
  getPref: (type: NotificationTypeKey) => NotificationPreferenceDto | undefined;
  onChange: (pref: NotificationPreferenceDto, enabled: boolean) => void;
};

export function PreferencesGroupCard({
  title,
  subtitle,
  ariaLabel,
  types,
  items,
  getGroupState,
  groupStatus,
  toggleGroup,
  getPref,
  onChange,
}: Props) {
  const state = getGroupState(types);
  const status = groupStatus(state);

  return (
    <div className="rounded-lg border border-border/70 bg-muted/10 p-2 shadow-sm">
      <div
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        onClick={() => toggleGroup(types, state === true ? false : true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleGroup(types, state === true ? false : true);
          }
        }}
        className="flex w-full cursor-pointer items-start justify-between gap-4 rounded-md bg-muted/25 px-2 py-2 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold">{title}</div>
            <span
              className={cn(
                "rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium",
                status.className,
              )}
            >
              {status.label}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">{subtitle}</div>
        </div>
        <Switch
          checked={state === true}
          onCheckedChange={(checked) => toggleGroup(types, checked)}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="mt-0.5"
          aria-label={ariaLabel}
        />
      </div>
      <Separator className="my-2 opacity-50" />
      <div className="relative space-y-2">
        <div className="pointer-events-none absolute bottom-2 left-4 top-2 w-px bg-border/70" />
        {items.map((item, idx) => (
          <React.Fragment key={item.type}>
            <PreferenceRow
              title={item.title}
              description={item.description}
              pref={getPref(item.type)}
              onChange={onChange}
            />
            {idx < items.length - 1 ? <Separator className="my-2 opacity-50" /> : null}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
