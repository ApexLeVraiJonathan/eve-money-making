import CycleLinesPageClient from "./_components/cycle-lines-page-client";

export const dynamic = "force-dynamic";

type CycleLinesPageProps = {
  params: {
    cycleId: string;
  };
};

export default function CycleLinesPage({ params }: CycleLinesPageProps) {
  return <CycleLinesPageClient cycleId={params.cycleId} />;
}
