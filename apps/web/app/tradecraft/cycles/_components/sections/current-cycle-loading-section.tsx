import {
  Card,
  CardContent,
  CardHeader,
  Skeleton,
} from "@eve/ui";

export function CurrentCycleLoadingSection() {
  return (
    <section className="space-y-4">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-2 h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
