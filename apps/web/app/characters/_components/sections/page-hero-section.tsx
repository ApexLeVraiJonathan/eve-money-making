"use client";

import { Avatar, AvatarFallback, AvatarImage, Badge, Button, Card, CardContent, CardHeader, CardTitle, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, Skeleton } from "@eve/ui";
import { Star, UserPlus, Users } from "lucide-react";
import { getCharacterInitials } from "../lib/character-utils";

type LinkedCharacter = {
  id: number;
  name: string;
  isPrimary: boolean;
};

type PageHeroSectionProps = {
  linkedCharsLoading: boolean;
  linkedChars: LinkedCharacter[];
  accountsCount: number;
  totalWallet: number;
  isHeroLoading: boolean;
  currentCharacterName?: string;
  enabledFeatures: string[];
  featureDialogOpen: boolean;
  onFeatureDialogOpenChange: (open: boolean) => void;
  selectedFeatures: string[];
  onToggleFeature: (key: string) => void;
  onSaveFeatures: () => Promise<void>;
  updateFeaturesPending: boolean;
  onStartLink: () => void;
};

export function PageHeroSection({
  linkedCharsLoading,
  linkedChars,
  accountsCount,
  totalWallet,
  isHeroLoading,
  currentCharacterName,
  enabledFeatures,
  featureDialogOpen,
  onFeatureDialogOpenChange,
  selectedFeatures,
  onToggleFeature,
  onSaveFeatures,
  updateFeaturesPending,
  onStartLink,
}: PageHeroSectionProps) {
  const primaryChar =
    linkedChars.find((character) => character.isPrimary) ?? linkedChars[0] ?? null;

  return (
    <section className="flex flex-col gap-4 md:flex-row md:items-stretch">
      <Card className="flex-1 bg-gradient-to-br from-background to-muted/20 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/20 text-primary shadow-sm">
              <Users className="h-6 w-6" />
            </span>
            Character Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-foreground/80">
            Central place to link your EVE characters, choose a primary, and
            manage accounts, PLEX, and boosters.
          </p>
          <div className="grid gap-2 sm:grid-cols-3 sm:gap-3">
            <div className="space-y-1 min-w-0">
              <div className="text-xs text-foreground/80">Linked characters</div>
              <div className="text-2xl font-bold tabular-nums text-foreground">
                {isHeroLoading ? (
                  <Skeleton className="h-7 w-16 rounded-md" />
                ) : (
                  linkedChars.length
                )}
              </div>
            </div>
            <div className="space-y-1 min-w-0">
              <div className="text-xs text-foreground/80">Accounts</div>
              <div className="text-2xl font-bold tabular-nums text-foreground">
                {isHeroLoading ? (
                  <Skeleton className="h-7 w-16 rounded-md" />
                ) : (
                  accountsCount
                )}
              </div>
            </div>
            <div className="space-y-1 min-w-0 overflow-hidden">
              <div className="text-xs text-foreground/80 whitespace-nowrap">
                Total wallet (ISK)
              </div>
              <div className="text-lg font-bold font-mono tabular-nums text-foreground leading-tight break-all sm:text-xl lg:text-2xl">
                {isHeroLoading ? (
                  <Skeleton className="h-7 w-32 rounded-md" />
                ) : (
                  totalWallet.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="w-full md:w-96 bg-gradient-to-br from-background to-muted/20 shadow-md">
        <CardHeader>
          <CardTitle>Quick actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button onClick={onStartLink} className="whitespace-nowrap shadow-sm">
            <UserPlus className="mr-2 h-4 w-4" />
            Link character
          </Button>
          <Dialog open={featureDialogOpen} onOpenChange={onFeatureDialogOpenChange}>
            <DialogTrigger asChild>
              <Button variant="outline" className="whitespace-nowrap shadow-sm">
                App access
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[420px]">
              <DialogHeader>
                <DialogTitle>App access</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <p className="text-foreground/70">
                  Choose which parts of the app you want this account to use.
                  Linking characters will request ESI scopes for the selected app
                  areas.
                </p>
                <div className="space-y-2">
                  <label className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2">
                    <span className="text-sm font-medium">Characters</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={
                        selectedFeatures.length
                          ? selectedFeatures.includes("CHARACTERS")
                          : enabledFeatures.includes("CHARACTERS")
                      }
                      onChange={() => onToggleFeature("CHARACTERS")}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2">
                    <span className="text-sm font-medium">Tradecraft</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={
                        selectedFeatures.length
                          ? selectedFeatures.includes("TRADECRAFT")
                          : enabledFeatures.length === 0 ||
                            enabledFeatures.includes("TRADECRAFT")
                      }
                      onChange={() => onToggleFeature("TRADECRAFT")}
                    />
                  </label>
                </div>
                <p className="text-xs text-foreground/60">
                  You can change these options later. New scopes are requested the
                  next time you link a character.
                </p>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onFeatureDialogOpenChange(false)}
                  type="button"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => void onSaveFeatures()}
                  disabled={updateFeaturesPending}
                >
                  {updateFeaturesPending ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          {linkedCharsLoading ? (
            <div className="mt-2 flex items-center gap-3 rounded-lg border bg-gradient-to-br from-background to-muted/30 p-3 shadow-sm">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="space-y-1 min-w-0 flex-1">
                <Skeleton className="h-4 w-32 rounded" />
                <Skeleton className="h-3 w-40 rounded" />
              </div>
            </div>
          ) : primaryChar ? (
            <div className="mt-2 flex items-center gap-3 rounded-lg border bg-gradient-to-br from-background to-muted/30 p-3 shadow-sm">
              <Avatar className="h-10 w-10 rounded-lg shadow-md ring-1 ring-background">
                <AvatarImage
                  src={`https://image.eveonline.com/Character/${primaryChar.id}_128.jpg`}
                  alt={primaryChar.name}
                />
                <AvatarFallback className="rounded-lg">
                  {getCharacterInitials(primaryChar.name)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-0.5 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold truncate">
                    {primaryChar.name}
                  </span>
                  <Badge variant="outline" className="gap-1 shrink-0 shadow-sm">
                    <Star className="h-3 w-3" />
                    Primary
                  </Badge>
                </div>
                {currentCharacterName && (
                  <p className="text-xs text-foreground/70 truncate">
                    Logged in as {currentCharacterName}
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
