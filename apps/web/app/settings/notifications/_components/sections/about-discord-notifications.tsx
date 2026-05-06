import { MessageCircle } from "lucide-react";

export function AboutDiscordNotifications() {
  return (
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
          When you connect Discord, we automatically add you to our official server so
          our bot can send you direct messages. You must stay in the server until you
          receive at least one message from the bot.
        </p>
        <p>
          After receiving your first message, you can leave the server if you wish.
          However, if you block the bot or disable DMs from server members in your
          Discord privacy settings, notifications will stop working.
        </p>
        <p className="pt-1 font-medium text-foreground">
          We only request minimum Discord permissions: identity and DM access. You can
          disconnect anytime.
        </p>
      </div>
    </details>
  );
}
