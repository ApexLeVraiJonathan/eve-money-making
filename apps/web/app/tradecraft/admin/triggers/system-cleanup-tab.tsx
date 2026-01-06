"use client";

import * as React from "react";
import { Button } from "@eve/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@eve/ui";
import { TabsContent } from "@eve/ui";
import { toast } from "@eve/ui";
import { Loader2, Trash2, Shield } from "lucide-react";
import { useCleanupEsiCache, useCleanupOAuthState } from "../../api";

export function SystemCleanupTab() {
  const cleanupEsiCacheMutation = useCleanupEsiCache();
  const cleanupOAuthStateMutation = useCleanupOAuthState();

  return (
    <TabsContent value="system-cleanup" className="space-y-6">
      {/* ESI Cache Cleanup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            ESI Cache Cleanup
          </CardTitle>
          <CardDescription>
            Delete expired ESI cache entries to free up space and allow fresh
            data imports
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-amber-500/10 p-4 space-y-2">
            <h3 className="text-sm font-medium text-amber-900 dark:text-amber-100">
              ⚠️ When to use this
            </h3>
            <ul className="text-sm text-amber-900/80 dark:text-amber-100/80 space-y-1 list-disc list-inside">
              <li>
                Before re-importing wallet journals if you just made a payment
              </li>
              <li>
                ESI caches wallet data for ~5 minutes (varies by endpoint)
              </li>
              <li>
                Cleanup removes only <strong>expired</strong> entries, not all
                cache
              </li>
              <li>
                With jobs disabled, cleanup doesn&apos;t run automatically
              </li>
            </ul>
          </div>

          <Button
            onClick={async () => {
              try {
                const data = await cleanupEsiCacheMutation.mutateAsync();
                toast.success(
                  `Cleaned up ${data.cleaned || 0} expired cache entries`,
                );
              } catch (error) {
                const errorMessage =
                  error instanceof Error
                    ? error.message
                    : "Failed to cleanup cache";
                toast.error(errorMessage);
              }
            }}
            disabled={cleanupEsiCacheMutation.isPending}
            className="gap-2 w-full sm:w-auto"
            variant="outline"
          >
            {cleanupEsiCacheMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Clean Expired Cache
          </Button>
        </CardContent>
      </Card>

      {/* OAuth State Cleanup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            OAuth State Cleanup
          </CardTitle>
          <CardDescription>
            Remove expired OAuth state entries from SSO flows
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            <h3 className="text-sm font-medium">What this does</h3>
            <p className="text-sm text-muted-foreground">
              OAuth states are temporary entries created during EVE SSO login
              flows. They expire after 10 minutes but accumulate in the database
              if jobs are disabled.
            </p>
          </div>

          <Button
            onClick={async () => {
              try {
                const data = await cleanupOAuthStateMutation.mutateAsync();
                toast.success(
                  `Cleaned up ${data.cleaned || 0} expired OAuth states`,
                );
              } catch (error) {
                const errorMessage =
                  error instanceof Error
                    ? error.message
                    : "Failed to cleanup OAuth states";
                toast.error(errorMessage);
              }
            }}
            disabled={cleanupOAuthStateMutation.isPending}
            className="gap-2 w-full sm:w-auto"
            variant="outline"
          >
            {cleanupOAuthStateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Shield className="h-4 w-4" />
            )}
            Clean Expired OAuth States
          </Button>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
