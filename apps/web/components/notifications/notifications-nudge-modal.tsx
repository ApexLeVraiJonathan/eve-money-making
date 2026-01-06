"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, BellOff, MessageCircle } from "lucide-react";

import { useCurrentUser } from "@/app/tradecraft/api/characters/users.hooks";
import {
  startDiscordConnect,
  useDiscordAccount,
  useNotificationPreferences,
} from "@/app/tradecraft/api/notifications.hooks";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@eve/ui";

const DISMISS_COOKIE_KEY = "eve_notifications_prompt_dismissed";
const SNOOZE_COOKIE_KEY = "eve_notifications_prompt_snooze_until";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const raw = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  if (!raw) return null;
  return raw.split("=").slice(1).join("=") || null;
}

function setCookie(name: string, value: string, days: number) {
  if (typeof document === "undefined") return;
  const expires = new Date();
  expires.setDate(expires.getDate() + days);
  document.cookie = `${name}=${encodeURIComponent(
    value,
  )}; expires=${expires.toUTCString()}; path=/; samesite=lax`;
}

export function NotificationsNudgeModal() {
  const pathname = usePathname() ?? "/";
  const { data: me } = useCurrentUser();
  const { data: discord, isLoading: loadingDiscord } = useDiscordAccount();
  const { data: prefs = [], isLoading: loadingPrefs } =
    useNotificationPreferences();

  const [returnUrl, setReturnUrl] = React.useState<string | undefined>(
    undefined,
  );
  const [open, setOpen] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);
  const [snoozeUntilMs, setSnoozeUntilMs] = React.useState<number | null>(null);

  React.useEffect(() => {
    const dismissedCookie = getCookie(DISMISS_COOKIE_KEY);
    if (dismissedCookie === "true") setDismissed(true);
    const snoozeCookie = getCookie(SNOOZE_COOKIE_KEY);
    const snoozeMs = snoozeCookie ? Number(snoozeCookie) : NaN;
    if (Number.isFinite(snoozeMs) && snoozeMs > 0) setSnoozeUntilMs(snoozeMs);
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    setReturnUrl(
      `${window.location.origin}/settings/notifications?from=tradecraft&autoEnable=cycle_planned`,
    );
  }, []);

  const hasAnyEnabled =
    prefs?.some((p) => p.channel === "DISCORD_DM" && p.enabled) ?? false;

  // Only nudge on Tradecraft user-facing pages (not admin, not the settings page itself).
  const isTradecraft =
    pathname === "/tradecraft" || pathname.startsWith("/tradecraft/");
  const isTradecraftAdmin = pathname.startsWith("/tradecraft/admin");
  const isNotificationsSettings = pathname === "/settings/notifications";

  const isEligibleRoute =
    isTradecraft && !isTradecraftAdmin && !isNotificationsSettings;

  const now = Date.now();
  const isSnoozed = typeof snoozeUntilMs === "number" && snoozeUntilMs > now;

  const shouldOpen =
    isEligibleRoute &&
    !!me?.userId &&
    !dismissed &&
    !isSnoozed &&
    !loadingDiscord &&
    !loadingPrefs &&
    !hasAnyEnabled;

  React.useEffect(() => {
    // Open only after we have loaded state to avoid hydration flicker.
    if (shouldOpen) setOpen(true);
  }, [shouldOpen]);

  const handleDontShowAgain = () => {
    setDismissed(true);
    setCookie(DISMISS_COOKIE_KEY, "true", 365);
    setOpen(false);
  };

  const handleRemindLater = () => {
    const until = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
    setSnoozeUntilMs(until);
    setCookie(SNOOZE_COOKIE_KEY, String(until), 7);
    setOpen(false);
  };

  const handleConnectDiscord = () => {
    // Close the modal immediately to avoid flicker if navigation is delayed.
    setOpen(false);
    startDiscordConnect(returnUrl);
  };

  if (!isEligibleRoute) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary">
              <MessageCircle className="h-4 w-4" />
            </span>
            Get cycle updates on Discord
          </DialogTitle>
          <DialogDescription className="text-sm">
            Connect Discord and enable DMs so you don’t miss cycle opt-ins,
            rollovers, results, and payouts.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <div className="flex items-start gap-2">
            <Bell className="h-4 w-4 mt-0.5 text-primary" />
            <div>
              <div className="font-medium">Recommended</div>
              <div className="text-foreground/70">
                Enable at least: Cycle planned, Cycle started, and Payout sent.
              </div>
            </div>
          </div>
          {!discord ? (
            <div className="mt-2 text-foreground/70">
              Status: <span className="font-medium">Discord not connected</span>
            </div>
          ) : null}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRemindLater}
              className="inline-flex items-center gap-2"
            >
              <Bell className="h-3.5 w-3.5" />
              Remind me later
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDontShowAgain}
              className="inline-flex items-center gap-2"
            >
              <BellOff className="h-3.5 w-3.5" />
              Don&apos;t show again
            </Button>
          </div>

          {discord ? (
            <Link href="/settings/notifications" onClick={() => setOpen(false)}>
              <Button size="sm" className="inline-flex items-center gap-2">
                <MessageCircle className="h-3.5 w-3.5" />
                Set up notifications
              </Button>
            </Link>
          ) : (
            <Button
              size="sm"
              className="inline-flex items-center gap-2"
              onClick={handleConnectDiscord}
              disabled={!returnUrl}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Connect Discord
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
