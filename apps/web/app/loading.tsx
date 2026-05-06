import { Skeleton } from "@eve/ui";

export default function Loading() {
  return (
    <div className="container mx-auto max-w-6xl p-8 space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
      </div>
    </div>
  );
}
