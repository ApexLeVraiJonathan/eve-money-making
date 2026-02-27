"use client";

import { useEffect } from "react";
import { Button } from "@eve/ui";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App route error boundary caught:", error);
  }, [error]);

  return (
    <div className="container mx-auto max-w-3xl p-8 space-y-4">
      <h2 className="text-2xl font-semibold">Something went wrong</h2>
      <p className="text-muted-foreground">
        The page failed to load. You can retry once.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
