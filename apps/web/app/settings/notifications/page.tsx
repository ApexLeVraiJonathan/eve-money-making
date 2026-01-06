"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  cn,
  Separator,
  Skeleton,
  Checkbox,
  Switch,
  toast,
} from "@eve/ui";
import {
  Bell,
  BellOff,
  Loader2,
  Shield,
  UserX,
  MessageCircle,
} from "lucide-react";
import {
  useDiscordAccount,
  useNotificationPreferences,
  useUpdateNotificationPreferences,
  useDisconnectDiscord,
  useSendTestNotification,
  startDiscordConnect,
  type NotificationPreferenceDto,
} from "@/app/tradecraft/api/notifications.hooks";
import { useCurrentUser } from "@/app/tradecraft/api/characters/users.hooks";

const TRADECRAFT_TYPES = [
  "CYCLE_PLANNED",
  "CYCLE_STARTED",
  "CYCLE_RESULTS",
  "CYCLE_PAYOUT_SENT",
] as const;

const CHARACTERS_TYPES = [
  "SKILL_PLAN_REMAP_REMINDER",
  "SKILL_PLAN_COMPLETION",
  "PLEX_ENDING",
  "MCT_ENDING",
  "BOOSTER_ENDING",
  "TRAINING_QUEUE_IDLE",
] as const;

type NotificationTypeKey =
  | (typeof TRADECRAFT_TYPES)[number]
  | (typeof CHARACTERS_TYPES)[number];

type PrefItem = {
  type: NotificationTypeKey;
  title: string;
  description: string;
};

const TRADECRAFT_ITEMS: PrefItem[] = [
  {
    type: "CYCLE_PLANNED",
    title: "Cycle planned",
    description: "New investment cycle opens for opt-in",
  },
  {
    type: "CYCLE_STARTED",
    title: "Cycle started",
    description: "Trading begins on your opted-in cycle",
  },
  {
    type: "CYCLE_RESULTS",
    title: "Cycle results ready",
    description: "Performance summary is finalized",
  },
  {
    type: "CYCLE_PAYOUT_SENT",
    title: "Payout sent",
    description: "Your cycle payout has been processed",
  },
];

const CHARACTERS_ITEMS: PrefItem[] = [
  {
    type: "SKILL_PLAN_REMAP_REMINDER",
    title: "Skill plan remap reminders",
    description:
      "Discord DMs before planned attribute remaps for assigned skill plans",
  },
  {
    type: "SKILL_PLAN_COMPLETION",
    title: "Skill plan completion",
    description: "Discord DMs shortly before assigned skill plans complete",
  },
  {
    type: "PLEX_ENDING",
    title: "PLEX ending",
    description:
      "Reminders when tracked PLEX or account subscription time is close to expiring",
  },
  {
    type: "MCT_ENDING",
    title: "MCT ending",
    description:
      "Reminders when tracked MCT training slots are close to expiring",
  },
  {
    type: "BOOSTER_ENDING",
    title: "Booster ending",
    description:
      "Reminders when an active character booster is close to expiring",
  },
  {
    type: "TRAINING_QUEUE_IDLE",
    title: "Training queue idle",
    description:
      "Alerts when a character has available training time but no skills queued",
  },
];

function useReturnUrl() {
  const [url, setUrl] = React.useState<string | undefined>(undefined);
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setUrl(window.location.origin + "/settings/notifications");
    }
  }, []);
  return url;
}

function NotificationSettingsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = useReturnUrl();
  const { data: me } = useCurrentUser();
  const {
    data: discord,
    isLoading: loadingDiscord,
    refetch: refetchDiscord,
  } = useDiscordAccount();
  const {
    data: preferences = [],
    isLoading: loadingPrefs,
    refetch: refetchPrefs,
  } = useNotificationPreferences();

  const updatePrefs = useUpdateNotificationPreferences();
  const disconnectDiscord = useDisconnectDiscord();
  const sendTest = useSendTestNotification();

  const [localPrefs, setLocalPrefs] = React.useState<
    NotificationPreferenceDto[]
  >([]);
  const [autoEnableDone, setAutoEnableDone] = React.useState(false);
  const [lastSavedAt, setLastSavedAt] = React.useState<number | null>(null);
  const [testState, setTestState] = React.useState<
    | { kind: "idle" }
    | { kind: "sending" }
    | { kind: "success"; at: number }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  React.useEffect(() => {
    setLocalPrefs(preferences);
  }, [preferences]);

  // If the user arrived here from a Tradecraft flow, auto-enable a single
  // high-signal notification to improve adoption (Cycle planned).
  React.useEffect(() => {
    const from = searchParams?.get("from");
    const autoEnable = searchParams?.get("autoEnable");
    const shouldAutoEnable =
      from === "tradecraft" && autoEnable === "cycle_planned";

    if (!shouldAutoEnable) return;
    if (autoEnableDone) return;
    if (!discord) return; // wait until connected
    if (loadingPrefs) return;
    if (updatePrefs.isPending) return;

    const hasCyclePlannedEnabled = preferences.some(
      (p) =>
        p.channel === "DISCORD_DM" &&
        p.notificationType === "CYCLE_PLANNED" &&
        p.enabled,
    );
    if (hasCyclePlannedEnabled) {
      setAutoEnableDone(true);
      router.replace("/settings/notifications");
      return;
    }

    setAutoEnableDone(true);

    const next = (() => {
      const exists = preferences.some(
        (p) =>
          p.channel === "DISCORD_DM" && p.notificationType === "CYCLE_PLANNED",
      );
      if (!exists) {
        return [
          ...preferences,
          {
            channel: "DISCORD_DM",
            notificationType: "CYCLE_PLANNED",
            enabled: true,
          } satisfies NotificationPreferenceDto,
        ];
      }
      return preferences.map((p) =>
        p.channel === "DISCORD_DM" && p.notificationType === "CYCLE_PLANNED"
          ? { ...p, enabled: true }
          : p,
      );
    })();

    void (async () => {
      try {
        await updatePrefs.mutateAsync(next);
        await refetchPrefs();
        toast.success("Enabled Discord DM: Cycle planned");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : String(e));
      } finally {
        router.replace("/settings/notifications");
      }
    })();
  }, [
    autoEnableDone,
    discord,
    loadingPrefs,
    preferences,
    refetchPrefs,
    router,
    searchParams,
    updatePrefs,
  ]);

  const handleToggle = (pref: NotificationPreferenceDto, enabled: boolean) => {
    setLocalPrefs((prev) =>
      prev.map((p) =>
        p.channel === pref.channel &&
        p.notificationType === pref.notificationType
          ? { ...p, enabled }
          : p,
      ),
    );
  };

  const getPref = (type: NotificationTypeKey) =>
    localPrefs.find(
      (p) => p.channel === "DISCORD_DM" && p.notificationType === type,
    );

  const getGroupState = (types: readonly NotificationTypeKey[]) => {
    const enabledCount = types.reduce(
      (acc, t) => acc + (getPref(t)?.enabled ? 1 : 0),
      0,
    );
    if (enabledCount === 0) return false as const;
    if (enabledCount === types.length) return true as const;
    return "indeterminate" as const;
  };

  const groupStatus = React.useCallback((state: boolean | "indeterminate") => {
    if (state === true)
      return {
        label: "All on",
        className: "text-green-600 dark:text-green-400",
      } as const;
    if (state === "indeterminate")
      return {
        label: "Some",
        className: "text-amber-600 dark:text-amber-400",
      } as const;
    return { label: "All off", className: "text-muted-foreground" } as const;
  }, []);

  const toggleGroup = (
    types: readonly NotificationTypeKey[],
    value: boolean | "indeterminate",
  ) => {
    const enabled = value === true;
    setLocalPrefs((prev) =>
      prev.map((p) =>
        p.channel === "DISCORD_DM" &&
        (types as readonly string[]).includes(p.notificationType)
          ? { ...p, enabled }
          : p,
      ),
    );
  };

  const handleSave = async () => {
    try {
      // Count changes for feedback
      const changedPrefs = localPrefs.filter((local) => {
        const original = preferences.find(
          (p) =>
            p.channel === local.channel &&
            p.notificationType === local.notificationType,
        );
        return original?.enabled !== local.enabled;
      });

      await updatePrefs.mutateAsync(localPrefs);
      await Promise.all([refetchPrefs(), refetchDiscord()]);
      setLastSavedAt(Date.now());

      const enabledCount = changedPrefs.filter((p) => p.enabled).length;
      const disabledCount = changedPrefs.filter((p) => !p.enabled).length;

      let message = "Notification preferences updated";
      if (enabledCount > 0 && disabledCount > 0) {
        message = `${enabledCount} enabled, ${disabledCount} disabled`;
      } else if (enabledCount > 0) {
        message = `${enabledCount} notification${enabledCount > 1 ? "s" : ""} enabled`;
      } else if (disabledCount > 0) {
        message = `${disabledCount} notification${disabledCount > 1 ? "s" : ""} disabled`;
      }

      toast.success(message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleDisconnect = async () => {
    if (
      !confirm(
        "Are you sure you want to disconnect Discord? All notification preferences will be disabled until you reconnect.",
      )
    ) {
      return;
    }

    try {
      await disconnectDiscord.mutateAsync();
      await Promise.all([refetchDiscord(), refetchPrefs()]);
      toast.success("Discord account disconnected");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const isSaving =
    updatePrefs.isPending || disconnectDiscord.isPending || sendTest.isPending;

  const hasAnyEnabled =
    localPrefs?.some((p) => p.channel === "DISCORD_DM" && p.enabled) ?? false;

  const hasChanges = React.useMemo(() => {
    return JSON.stringify(localPrefs) !== JSON.stringify(preferences);
  }, [localPrefs, preferences]);

  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-6 md:p-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Notification Settings
        </h1>
        <p className="text-muted-foreground">
          Control how you receive updates about arbitrage cycles and payouts.
        </p>
      </div>

      {/* Discord Connection and Notification Toggles - Combined Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageCircle className="h-5 w-5 text-indigo-400" />
                Discord Notifications
              </CardTitle>
              <CardDescription className="text-sm">
                Connect Discord to receive direct messages about cycles and
                payouts.
              </CardDescription>
            </div>
            {me && (
              <Badge variant="outline" className="hidden gap-1 md:inline-flex">
                <Shield className="h-3 w-3" />
                User ID: {me.userId ?? "anonymous"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Connection Status */}
          {loadingDiscord ? (
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ) : discord ? (
            <div className="flex flex-col gap-3 rounded-lg border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 p-3 shadow-sm shadow-indigo-500/10 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 ring-2 ring-indigo-500/20">
                  <MessageCircle className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-sm font-semibold">
                    {discord.username}
                    {discord.discriminator ? `#${discord.discriminator}` : null}
                  </div>
                  <div className="text-xs text-muted-foreground/90">
                    Connected {new Date(discord.linkedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={isSaving}
                className="shrink-0 transition-all hover:border-destructive hover:text-destructive"
              >
                {isSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <UserX className="h-3.5 w-3.5" />
                )}
                Disconnect
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <MessageCircle className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-sm font-semibold">Not connected</div>
                  <div className="text-xs text-muted-foreground/90">
                    Connect to enable notifications
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => startDiscordConnect(returnUrl)}
                className="shrink-0"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Connect Discord
              </Button>
            </div>
          )}

          <Separator />

          {/* Notification Preferences */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Notification Types</h3>
              {discord && (
                <div className="flex items-center gap-1.5 text-xs">
                  {hasAnyEnabled ? (
                    <>
                      <Bell className="h-3.5 w-3.5 text-green-500" />
                      <span className="font-medium text-green-600 dark:text-green-400">
                        Active
                      </span>
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
            ) : !discord ? (
              <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-center text-sm text-muted-foreground">
                Connect Discord above to configure notification preferences
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {/* Tradecraft */}
                <div className="rounded-lg border border-border/70 bg-muted/10 p-2 shadow-sm">
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label="Toggle all Tradecraft notifications"
                    onClick={() =>
                      toggleGroup(
                        TRADECRAFT_TYPES,
                        getGroupState(TRADECRAFT_TYPES) === true ? false : true,
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleGroup(
                          TRADECRAFT_TYPES,
                          getGroupState(TRADECRAFT_TYPES) === true
                            ? false
                            : true,
                        );
                      }
                    }}
                    className="flex w-full cursor-pointer items-start justify-between gap-4 rounded-md bg-muted/25 px-2 py-2 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold">Tradecraft</div>
                        {(() => {
                          const s = groupStatus(
                            getGroupState(TRADECRAFT_TYPES),
                          );
                          return (
                            <span
                              className={cn(
                                "rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium",
                                s.className,
                              )}
                            >
                              {s.label}
                            </span>
                          );
                        })()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Cycle events and payouts
                      </div>
                    </div>
                    <Switch
                      checked={getGroupState(TRADECRAFT_TYPES) === true}
                      onCheckedChange={(checked) =>
                        toggleGroup(TRADECRAFT_TYPES, checked)
                      }
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="mt-0.5"
                      aria-label="Toggle all Tradecraft notifications"
                    />
                  </div>
                  <Separator className="my-2 opacity-50" />
                  <div className="relative space-y-2">
                    <div className="pointer-events-none absolute bottom-2 left-4 top-2 w-px bg-border/70" />
                    {TRADECRAFT_ITEMS.map((item, idx) => (
                      <React.Fragment key={item.type}>
                        <PreferenceRow
                          title={item.title}
                          description={item.description}
                          pref={getPref(item.type)}
                          onChange={handleToggle}
                        />
                        {idx < TRADECRAFT_ITEMS.length - 1 ? (
                          <Separator className="my-2 opacity-50" />
                        ) : null}
                      </React.Fragment>
                    ))}
                  </div>
                  <Separator className="my-2 opacity-50" />
                </div>

                {/* Characters */}
                <div className="rounded-lg border border-border/70 bg-muted/10 p-2 shadow-sm">
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label="Toggle all Characters notifications"
                    onClick={() =>
                      toggleGroup(
                        CHARACTERS_TYPES,
                        getGroupState(CHARACTERS_TYPES) === true ? false : true,
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleGroup(
                          CHARACTERS_TYPES,
                          getGroupState(CHARACTERS_TYPES) === true
                            ? false
                            : true,
                        );
                      }
                    }}
                    className="flex w-full cursor-pointer items-start justify-between gap-4 rounded-md bg-muted/25 px-2 py-2 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold">Characters</div>
                        {(() => {
                          const s = groupStatus(
                            getGroupState(CHARACTERS_TYPES),
                          );
                          return (
                            <span
                              className={cn(
                                "rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium",
                                s.className,
                              )}
                            >
                              {s.label}
                            </span>
                          );
                        })()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Skill plans and account reminders
                      </div>
                    </div>
                    <Switch
                      checked={getGroupState(CHARACTERS_TYPES) === true}
                      onCheckedChange={(checked) =>
                        toggleGroup(CHARACTERS_TYPES, checked)
                      }
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="mt-0.5"
                      aria-label="Toggle all Characters notifications"
                    />
                  </div>
                  <Separator className="my-2 opacity-50" />
                  <div className="relative space-y-2">
                    <div className="pointer-events-none absolute bottom-2 left-4 top-2 w-px bg-border/70" />
                    {CHARACTERS_ITEMS.map((item, idx) => (
                      <React.Fragment key={item.type}>
                        <PreferenceRow
                          title={item.title}
                          description={item.description}
                          pref={getPref(item.type)}
                          onChange={handleToggle}
                        />
                        {idx < CHARACTERS_ITEMS.length - 1 ? (
                          <Separator className="my-2 opacity-50" />
                        ) : null}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Test Button - Compact inline */}
          {discord && (
            <>
              <Separator />
              <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Shield className="h-3.5 w-3.5" />
                  <span className="flex items-center gap-2">
                    <span>Test your notification setup</span>
                    {testState.kind === "sending" ? (
                      <span className="text-muted-foreground">Sending…</span>
                    ) : testState.kind === "success" ? (
                      <span className="text-green-600 dark:text-green-400">
                        Test sent {new Date(testState.at).toLocaleTimeString()}
                      </span>
                    ) : testState.kind === "error" ? (
                      <span className="text-destructive">
                        {testState.message}
                      </span>
                    ) : null}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={sendTest.isPending || !discord}
                  onClick={async () => {
                    try {
                      setTestState({ kind: "sending" });
                      const res = await sendTest.mutateAsync();
                      if (res.ok) {
                        toast.success("Test DM sent successfully!");
                        setTestState({ kind: "success", at: Date.now() });
                      } else {
                        toast.error(
                          res.error ?? "Failed to send test notification",
                        );
                        setTestState({
                          kind: "error",
                          message:
                            res.error ?? "Failed to send test notification",
                        });
                      }
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : String(e));
                      setTestState({
                        kind: "error",
                        message: e instanceof Error ? e.message : String(e),
                      });
                    }
                  }}
                  className="h-8 shrink-0"
                >
                  {sendTest.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Bell className="h-3.5 w-3.5" />
                  )}
                  Send Test
                </Button>
              </div>
            </>
          )}

          {/* Save Changes Footer */}
          {discord && (
            <>
              <Separator />
              <div className="flex items-center justify-between gap-3">
                {hasChanges ? (
                  <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-amber-600 dark:bg-amber-400" />
                    <span className="font-medium">Unsaved changes</span>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    All changes saved
                    {lastSavedAt ? (
                      <span className="ml-2">
                        (last saved {new Date(lastSavedAt).toLocaleTimeString()}
                        )
                      </span>
                    ) : null}
                  </div>
                )}
                <Button
                  type="button"
                  size="sm"
                  disabled={isSaving || !hasChanges}
                  onClick={handleSave}
                  className="h-9"
                >
                  {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Preferences
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Help Section - Collapsible */}
      <details className="group rounded-lg border bg-card p-4 text-sm">
        <summary className="flex cursor-pointer items-center justify-between font-medium">
          <span className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
            About Discord Notifications
          </span>
          <span className="text-muted-foreground transition-transform group-open:rotate-180">
            ▼
          </span>
        </summary>
        <div className="mt-3 space-y-2 text-xs text-muted-foreground">
          <p>
            When you connect Discord, we automatically add you to our official
            server so our bot can send you direct messages. You must stay in the
            server until you receive at least one message from the bot.
          </p>
          <p>
            After receiving your first message, you can leave the server if you
            wish. However, if you block the bot or disable DMs from server
            members in your Discord privacy settings, notifications will stop
            working.
          </p>
          <p className="pt-1 font-medium text-foreground">
            We only request minimum Discord permissions: identity and DM access.
            You can disconnect anytime.
          </p>
        </div>
      </details>
    </div>
  );
}

export default function NotificationSettingsPage() {
  // Next.js requires `useSearchParams()` usage to be wrapped in a Suspense boundary
  // to avoid CSR bailout issues during production builds.
  return (
    <React.Suspense
      fallback={
        <div className="container mx-auto max-w-5xl space-y-6 p-6 md:p-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">
              Notification Settings
            </h1>
            <p className="text-muted-foreground">
              Control how you receive updates about arbitrage cycles and
              payouts.
            </p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Loading…</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </CardContent>
          </Card>
        </div>
      }
    >
      <NotificationSettingsInner />
    </React.Suspense>
  );
}

type PreferenceRowProps = {
  title: string;
  description: string;
  pref: NotificationPreferenceDto | undefined;
  onChange: (pref: NotificationPreferenceDto, enabled: boolean) => void;
};

function PreferenceRow({
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
