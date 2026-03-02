import StrategyRunDetailPageClient from "./_components/strategy-run-detail-page-client";

export default async function StrategyRunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  return <StrategyRunDetailPageClient runId={runId} />;
}
