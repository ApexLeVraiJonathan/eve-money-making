import { Suspense } from "react";
import CycleProfitPageClient from "./_components/cycle-profit-page-client";

export const dynamic = "force-dynamic";

export default function CycleProfitPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <CycleProfitPageClient />
    </Suspense>
  );
}
