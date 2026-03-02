import Link from "next/link";
import { Card, CardContent, CardHeader } from "@eve/ui/card";
import { Button } from "@eve/ui/button";
import { Skeleton } from "@eve/ui/skeleton";

export function TrackingLoadingState() {
  return (
    <div className="space-y-4">
      {[1, 2].map((i) => (
        <Card key={i} className="bg-gradient-to-b from-background to-muted/5">
          <CardHeader>
            <Skeleton className="h-5 w-48" />
            <Skeleton className="mt-2 h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function TrackingEmptyState() {
  return (
    <div className="space-y-3">
      <p className="text-sm text-foreground/80">
        No active farm characters configured yet. Mark characters as active on
        the Skill Farm Characters page.
      </p>
      <Button asChild variant="outline" size="sm">
        <Link href="/characters/skill-farms/characters">Manage characters</Link>
      </Button>
    </div>
  );
}
