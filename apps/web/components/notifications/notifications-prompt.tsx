"use client";

import * as React from "react";
import { useNotificationPreferences } from "@/app/tradecraft/api/notifications.hooks";
import { useCurrentUser } from "@/app/tradecraft/api/characters/users.hooks";
import { Button, Card } from "@eve/ui";
import { Bell, BellOff } from "lucide-react";
import Link from "next/link";

const COOKIE_KEY = "eve_notifications_prompt_dismissed";

export function NotificationsPrompt() {
  const { data: me } = useCurrentUser();
  const { data: prefs = [], isLoading } = useNotificationPreferences(
    !!me?.userId,
  );
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const existing = document.cookie
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${COOKIE_KEY}=`));
    if (existing && existing.split("=")[1] === "true") {
      setDismissed(true);
    }
  }, []);

  const hasAnyEnabled =
    prefs?.some((p) => p.channel === "DISCORD_DM" && p.enabled) ?? false;

  const shouldShow = !isLoading && !!me?.userId && !dismissed && !hasAnyEnabled;

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof document === "undefined") return;
    const expires = new Date();
    expires.setMonth(expires.getMonth() + 12);
    document.cookie = `${COOKIE_KEY}=true; expires=${expires.toUTCString()}; path=/; samesite=lax`;
  };

  if (!shouldShow) return null;

  return (
    <Card className="border-dashed border-yellow-600/60 bg-yellow-950/30 p-4 text-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-yellow-500/15 text-yellow-400">
            <Bell className="h-4 w-4" />
          </span>
          <div className="space-y-1">
            <div className="font-medium">
              Stay in the loop with Discord notifications
            </div>
            <p className="text-xs text-muted-foreground max-w-xl">
              You currently don&apos;t have Discord notifications enabled. You
              can opt in to receive DMs when cycles are planned, started,
              results are published, and payouts are sent.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/settings/notifications">
            <Button size="sm" className="inline-flex items-center gap-2">
              <Bell className="h-3.5 w-3.5" />
              Configure notifications
            </Button>
          </Link>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="inline-flex items-center gap-2 text-xs"
            onClick={handleDismiss}
          >
            <BellOff className="h-3.5 w-3.5" />
            Don&apos;t show again
          </Button>
        </div>
      </div>
    </Card>
  );
}
