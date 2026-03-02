import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@eve/ui";

export function SettingsPageSkeleton() {
  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-6 md:p-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Notification Settings</h1>
        <p className="text-muted-foreground">
          Control how you receive updates about arbitrage cycles and payouts.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Loading…</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
