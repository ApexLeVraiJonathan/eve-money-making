import { Badge, Button, CardDescription, CardTitle, Skeleton } from "@eve/ui";
import { Loader2, MessageCircle, Shield, UserX } from "lucide-react";

type DiscordAccount = {
  username: string;
  discriminator?: string | null;
  linkedAt: string;
};

type Props = {
  showUserBadge: boolean;
  userId?: string | number | null;
  loadingDiscord: boolean;
  discord: DiscordAccount | null | undefined;
  isSaving: boolean;
  onDisconnect: () => void;
  onConnect: () => void;
};

export function DiscordConnectionSection({
  showUserBadge,
  userId,
  loadingDiscord,
  discord,
  isSaving,
  onDisconnect,
  onConnect,
}: Props) {
  return (
    <>
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageCircle className="h-5 w-5 text-indigo-400" />
            Discord Notifications
          </CardTitle>
          <CardDescription className="text-sm">
            Connect Discord to receive direct messages about cycles and payouts.
          </CardDescription>
        </div>
        {showUserBadge && (
          <Badge variant="outline" className="hidden gap-1 md:inline-flex">
            <Shield className="h-3 w-3" />
            User ID: {userId ?? "anonymous"}
          </Badge>
        )}
      </div>

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
            onClick={onDisconnect}
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
          <Button size="sm" onClick={onConnect} className="shrink-0">
            <MessageCircle className="h-3.5 w-3.5" />
            Connect Discord
          </Button>
        </div>
      )}
    </>
  );
}
