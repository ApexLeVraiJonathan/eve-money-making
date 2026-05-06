import { Button, Separator } from "@eve/ui";
import { Bell, Loader2, Shield } from "lucide-react";
import type { TestState } from "../lib/notification-settings-types";

type Props = {
  testState: TestState;
  sendTestPending: boolean;
  onSendTest: () => Promise<void>;
};

export function TestNotificationSection({
  testState,
  sendTestPending,
  onSendTest,
}: Props) {
  return (
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
              <span className="text-destructive">{testState.message}</span>
            ) : null}
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={sendTestPending}
          onClick={onSendTest}
          className="h-8 shrink-0"
        >
          {sendTestPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Bell className="h-3.5 w-3.5" />
          )}
          Send Test
        </Button>
      </div>
    </>
  );
}
