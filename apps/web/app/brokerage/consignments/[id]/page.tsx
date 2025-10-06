import { notFound } from "next/navigation";
import { MOCK_CONSIGNMENTS, formatISK } from "../../_mock/data";

type Props = { params: { id: string } };

export default function ConsignmentDetailPage({ params }: Props) {
  const consignment = MOCK_CONSIGNMENTS.find((c) => c.id === params.id);
  if (!consignment) return notFound();

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {consignment.title}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {consignment.hub} • {consignment.strategy} • Fee{" "}
          {consignment.feePercent}%
        </p>
      </div>

      <div className="grid gap-2 text-sm">
        <div>Estimated: {formatISK(consignment.estimatedValue)}</div>
        <div>Realized: {formatISK(consignment.realizedValue)}</div>
        <div>Left to sell: {formatISK(consignment.leftToSell)}</div>
        <div>Created: {new Date(consignment.createdAt).toLocaleString()}</div>
      </div>
    </div>
  );
}
