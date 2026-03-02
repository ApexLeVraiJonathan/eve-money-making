"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader } from "@eve/ui";
import {
  useDiscordAccount,
  useNotificationPreferences,
  useUpdateNotificationPreferences,
  useDisconnectDiscord,
  useSendTestNotification,
  startDiscordConnect,
} from "@/app/tradecraft/api/notifications.hooks";
import { useCurrentUser } from "@/app/tradecraft/api/characters/users.hooks";
import { TestNotificationSection } from "./sections/test-notification-section";
import { SavePreferencesSection } from "./sections/save-preferences-section";
import { NotificationTypesSection } from "./sections/notification-types-section";
import { DiscordConnectionSection } from "./sections/discord-connection-section";
import { AboutDiscordNotifications } from "./sections/about-discord-notifications";
import { NotificationSettingsHeader } from "./sections/notification-settings-header";
import type { TestState } from "./lib/notification-settings-types";
import { useReturnUrl } from "./lib/use-return-url";
import { useAutoEnableCyclePlanned } from "./lib/use-auto-enable-cycle-planned";
import { useNotificationPreferencesState } from "./lib/use-notification-preferences-state";
import { useNotificationSettingsActions } from "./lib/use-notification-settings-actions";

export default function NotificationSettingsPageClient() {
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

  const [lastSavedAt, setLastSavedAt] = React.useState<number | null>(null);
  const [testState, setTestState] = React.useState<TestState>({ kind: "idle" });

  useAutoEnableCyclePlanned({
    searchParams,
    router,
    discordConnected: Boolean(discord),
    loadingPrefs,
    preferences,
    updatePrefs,
    refetchPrefs,
  });

  const {
    localPrefs,
    hasAnyEnabled,
    hasChanges,
    handleToggle,
    getPref,
    getGroupState,
    groupStatus,
    toggleGroup,
  } = useNotificationPreferencesState(preferences);

  const { isSaving, handleSave, handleDisconnect, handleSendTest } =
    useNotificationSettingsActions({
      localPrefs,
      preferences,
      updatePrefs,
      disconnectDiscord,
      sendTest,
      refetchPrefs,
      refetchDiscord,
      setLastSavedAt,
      setTestState,
    });

  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-6 md:p-8">
      <NotificationSettingsHeader />

      <Card>
        <CardHeader>
          <DiscordConnectionSection
            showUserBadge={Boolean(me)}
            userId={me?.userId}
            loadingDiscord={loadingDiscord}
            discord={discord}
            isSaving={isSaving}
            onDisconnect={() => void handleDisconnect()}
            onConnect={() => startDiscordConnect(returnUrl)}
          />
        </CardHeader>
        <CardContent className="space-y-5">
          <NotificationTypesSection
            loadingPrefs={loadingPrefs}
            hasDiscord={Boolean(discord)}
            hasAnyEnabled={hasAnyEnabled}
            getGroupState={getGroupState}
            groupStatus={groupStatus}
            toggleGroup={toggleGroup}
            getPref={getPref}
            onToggle={handleToggle}
          />

          {discord && (
            <TestNotificationSection
              testState={testState}
              sendTestPending={sendTest.isPending}
              onSendTest={handleSendTest}
            />
          )}

          {discord && (
            <SavePreferencesSection
              hasChanges={hasChanges}
              lastSavedAt={lastSavedAt}
              isSaving={isSaving}
              onSave={() => void handleSave()}
            />
          )}
        </CardContent>
      </Card>

      <AboutDiscordNotifications />
    </div>
  );
}
