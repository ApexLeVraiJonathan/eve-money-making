import { Bell, BellOff } from "lucide-react";
import { Skeleton } from "@eve/ui";
import type { NotificationPreferenceDto } from "@/app/tradecraft/api/notifications.hooks";
import {
  CHARACTERS_ITEMS,
  CHARACTERS_TYPES,
  TRADECRAFT_ITEMS,
  TRADECRAFT_TYPES,
  type NotificationTypeKey,
} from "../lib/notification-types";
import { PreferencesGroupCard } from "./preferences-group-card";

type Props = {
  loadingPrefs: boolean;
  hasDiscord: boolean;
  hasAnyEnabled: boolean;
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
  onToggle: (pref: NotificationPreferenceDto, enabled: boolean) => void;
};

export function NotificationTypesSection({
  loadingPrefs,
  hasDiscord,
  hasAnyEnabled,
  getGroupState,
  groupStatus,
  toggleGroup,
  getPref,
  onToggle,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Notification Types</h3>
        {hasDiscord && (
          <div className="flex items-center gap-1.5 text-xs">
            {hasAnyEnabled ? (
              <>
                <Bell className="h-3.5 w-3.5 text-green-500" />
                <span className="font-medium text-green-600 dark:text-green-400">Active</span>
              </>
            ) : (
              <>
                <BellOff className="h-3.5 w-3.5 text-amber-500" />
                <span className="font-medium text-amber-600 dark:text-amber-400">
                  All off
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {loadingPrefs ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : !hasDiscord ? (
        <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-center text-sm text-muted-foreground">
          Connect Discord above to configure notification preferences
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <PreferencesGroupCard
            title="Tradecraft"
            subtitle="Cycle events and payouts"
            ariaLabel="Toggle all Tradecraft notifications"
            types={TRADECRAFT_TYPES}
            items={TRADECRAFT_ITEMS}
            getGroupState={getGroupState}
            groupStatus={groupStatus}
            toggleGroup={toggleGroup}
            getPref={getPref}
            onChange={onToggle}
          />
          <PreferencesGroupCard
            title="Characters"
            subtitle="Skill plans and account reminders"
            ariaLabel="Toggle all Characters notifications"
            types={CHARACTERS_TYPES}
            items={CHARACTERS_ITEMS}
            getGroupState={getGroupState}
            groupStatus={groupStatus}
            toggleGroup={toggleGroup}
            getPref={getPref}
            onChange={onToggle}
          />
        </div>
      )}
    </div>
  );
}
