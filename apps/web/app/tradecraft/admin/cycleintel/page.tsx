import { Suspense } from "react";
import CycleIntelPageClient from "./_components/cycle-intel-page-client";

export const dynamic = "force-dynamic";

export default function CycleLinesPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <CycleIntelPageClient />
    </Suspense>
  );
}
