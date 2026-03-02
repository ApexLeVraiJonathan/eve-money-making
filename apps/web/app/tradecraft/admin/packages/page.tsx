import { Suspense } from "react";
import PackagesPageClient from "./_components/packages-page-client";

export default function PackagesPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <PackagesPageClient />
    </Suspense>
  );
}
