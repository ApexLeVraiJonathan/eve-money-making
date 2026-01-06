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
import { toast } from "@eve/ui";
import { User, Shield, LogOut, AlertCircle } from "lucide-react";
import {
  useCurrentUser,
  logout,
} from "../tradecraft/api/characters/users.hooks";

export default function AccountSettingsPage() {
  const { data: me, error } = useCurrentUser();

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Logged out");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="container mx-auto max-w-4xl space-y-8 p-6 md:p-8">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and preferences
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

                  <p className="text-xs text-muted-foreground">
                    Linked characters and primary selection have moved to the{" "}
                    <span className="font-medium">Characters</span> app.
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:items-end">
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

      {/* Linked characters, PLEX, and boosters now live in the Characters app */}
    </div>
  );
}
