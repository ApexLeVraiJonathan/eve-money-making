"use client";

/**
 * No-op session provider now that authentication is handled entirely by the
 * backend via HTTP-only cookies and React Query hooks. Kept to avoid large
 * changes in the layout tree.
 */
export function SessionProvider({
  children,
}: {
  children: React.ReactNode;
  session?: unknown;
}) {
  return <>{children}</>;
}
