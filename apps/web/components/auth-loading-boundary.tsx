"use client";

import { Loader2 } from "lucide-react";

/**
 * Simple loading boundary that can be wired to future auth state if needed.
 * For now, it renders children immediately since auth is handled by the
 * backend session cookie and React Query hooks.
 */
export function AuthLoadingBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
