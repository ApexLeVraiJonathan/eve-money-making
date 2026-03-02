"use client";

import * as React from "react";
import { toast } from "@eve/ui";
import type { NotificationPreferenceDto } from "@/app/tradecraft/api/notifications.hooks";
import { buildSaveMessage, getChangedPrefs } from "./preference-changes";
import type { TestState } from "./notification-settings-types";

type UpdatePrefsMutation = {
  isPending: boolean;
  mutateAsync: (prefs: NotificationPreferenceDto[]) => Promise<unknown>;
};

type DisconnectDiscordMutation = {
  isPending: boolean;
  mutateAsync: () => Promise<unknown>;
};

type SendTestMutationResult = {
  ok: boolean;
  error?: string | null;
};

type SendTestMutation = {
  isPending: boolean;
  mutateAsync: () => Promise<SendTestMutationResult>;
};

type Params = {
  localPrefs: NotificationPreferenceDto[];
  preferences: NotificationPreferenceDto[];
  updatePrefs: UpdatePrefsMutation;
  disconnectDiscord: DisconnectDiscordMutation;
  sendTest: SendTestMutation;
  refetchPrefs: () => Promise<unknown>;
  refetchDiscord: () => Promise<unknown>;
  setLastSavedAt: React.Dispatch<React.SetStateAction<number | null>>;
  setTestState: React.Dispatch<React.SetStateAction<TestState>>;
};

export function useNotificationSettingsActions({
  localPrefs,
  preferences,
  updatePrefs,
  disconnectDiscord,
  sendTest,
  refetchPrefs,
  refetchDiscord,
  setLastSavedAt,
  setTestState,
}: Params) {
  const handleSave = React.useCallback(async () => {
    try {
      const changedPrefs = getChangedPrefs(localPrefs, preferences);

      await updatePrefs.mutateAsync(localPrefs);
      await Promise.all([refetchPrefs(), refetchDiscord()]);
      setLastSavedAt(Date.now());

      toast.success(buildSaveMessage(changedPrefs));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }, [
    localPrefs,
    preferences,
    refetchDiscord,
    refetchPrefs,
    setLastSavedAt,
    updatePrefs,
  ]);

  const handleDisconnect = React.useCallback(async () => {
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
  }, [disconnectDiscord, refetchDiscord, refetchPrefs]);

  const handleSendTest = React.useCallback(async () => {
    try {
      setTestState({ kind: "sending" });
      const res = await sendTest.mutateAsync();
      if (res.ok) {
        toast.success("Test DM sent successfully!");
        setTestState({ kind: "success", at: Date.now() });
      } else {
        const message = res.error ?? "Failed to send test notification";
        toast.error(message);
        setTestState({ kind: "error", message });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      toast.error(message);
      setTestState({ kind: "error", message });
    }
  }, [sendTest, setTestState]);

  const isSaving =
    updatePrefs.isPending || disconnectDiscord.isPending || sendTest.isPending;

  return {
    isSaving,
    handleSave,
    handleDisconnect,
    handleSendTest,
  };
}
