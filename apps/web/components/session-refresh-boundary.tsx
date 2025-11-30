"use client";

/**
 * No-op boundary now that authentication is handled entirely by the backend
 * via HTTP-only session cookies. Kept for API compatibility with the existing
 * layout tree.
 */
export function SessionRefreshBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
