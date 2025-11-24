"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@eve/ui";
import { Button } from "@eve/ui";
import { Badge } from "@eve/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@eve/ui";
import { Separator } from "@eve/ui";
import { toast } from "sonner";
import {
  User,
  Shield,
  Star,
  Unlink,
  UserPlus,
  LogOut,
  AlertCircle,
} from "lucide-react";
import {
  useCurrentUser,
  useMyCharacters,
  useSetPrimaryCharacter,
  useUnlinkCharacter,
  startCharacterLink,
  logout,
} from "../tradecraft/api/characters/users.hooks";

export default function AccountSettingsPage() {
  const { data: me, error } = useCurrentUser();
  const { data: chars = [] } = useMyCharacters();

  const setPrimaryMutation = useSetPrimaryCharacter();
  const unlinkMutation = useUnlinkCharacter();

  const setPrimary = async (id: number) => {
    try {
      await setPrimaryMutation.mutateAsync(id);
      toast.success("Primary character updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const unlink = async (id: number) => {
    try {
      await unlinkMutation.mutateAsync(id);
      toast.success("Character unlinked");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const startLink = () => {
    startCharacterLink(window.location.href);
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Logged out");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const primaryChar = chars.find((c) => c.isPrimary);

  return (
    <div className="container mx-auto max-w-4xl space-y-8 p-6 md:p-8">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-muted-foreground">
          Manage your account, linked characters, and preferences
        </p>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-3 pt-6">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-destructive">
              {error instanceof Error ? error.message : String(error)}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Account Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Account Overview
          </CardTitle>
          <CardDescription>Your account information and status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {me ? (
            <>
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Role:</span>
                    <Badge
                      variant={me.role === "ADMIN" ? "default" : "secondary"}
                    >
                      {me.role}
                    </Badge>
                  </div>

                  {primaryChar && (
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 rounded-lg">
                        <AvatarImage
                          src={`https://image.eveonline.com/Character/${primaryChar.id}_128.jpg`}
                          alt={primaryChar.name}
                        />
                        <AvatarFallback className="rounded-lg">
                          {primaryChar.name
                            .split(" ")
                            .map((s) => s[0])
                            .join("")
                            .slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {primaryChar.name}
                          </span>
                          <Badge variant="outline" className="gap-1">
                            <Star className="h-3 w-3" />
                            Primary
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Character ID: {primaryChar.id}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 sm:items-end">
                  <Button onClick={startLink} className="w-full sm:w-auto">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Link Character
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleLogout}
                    className="w-full sm:w-auto"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3 text-muted-foreground">
              <AlertCircle className="h-5 w-5" />
              <p>Not logged in</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Linked Characters */}
      <Card>
        <CardHeader>
          <CardTitle>Linked Characters</CardTitle>
          <CardDescription>
            Manage your EVE Online characters. Set a primary character to
            represent your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chars.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <User className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">
                No characters linked
              </h3>
              <p className="mb-6 text-sm text-muted-foreground">
                Link your first EVE Online character to get started
              </p>
              <Button onClick={startLink}>
                <UserPlus className="mr-2 h-4 w-4" />
                Link Character
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {chars.map((char, index) => (
                <React.Fragment key={char.id}>
                  {index > 0 && <Separator />}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12 rounded-lg">
                        <AvatarImage
                          src={`https://image.eveonline.com/Character/${char.id}_128.jpg`}
                          alt={char.name}
                        />
                        <AvatarFallback className="rounded-lg">
                          {char.name
                            .split(" ")
                            .map((s) => s[0])
                            .join("")
                            .slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{char.name}</span>
                          {char.isPrimary && (
                            <Badge variant="outline" className="gap-1">
                              <Star className="h-3 w-3" />
                              Primary
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          ID: {char.id}
                        </p>
                      </div>
                    </div>

                    {!char.isPrimary && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void setPrimary(char.id)}
                          disabled={setPrimaryMutation.isPending}
                        >
                          <Star className="mr-2 h-3 w-3" />
                          {setPrimaryMutation.isPending
                            ? "Setting…"
                            : "Set Primary"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void unlink(char.id)}
                          disabled={unlinkMutation.isPending}
                        >
                          <Unlink className="mr-2 h-3 w-3" />
                          {unlinkMutation.isPending ? "Unlinking…" : "Unlink"}
                        </Button>
                      </div>
                    )}
                  </div>
                </React.Fragment>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
