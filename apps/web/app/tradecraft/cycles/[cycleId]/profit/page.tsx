import { CycleProfitPageClient } from "./_components/cycle-profit-page-client";

type CycleProfitPageProps = {
  params: Promise<{ cycleId: string }>;
};

export default async function CycleProfitPage({ params }: CycleProfitPageProps) {
  const { cycleId } = await params;
  return <CycleProfitPageClient cycleId={cycleId} />;
}
