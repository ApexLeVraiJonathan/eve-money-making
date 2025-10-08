import { notFound } from "next/navigation";
import { MOCK_CONSIGNMENTS, formatISK } from "../../_mock/data";

type Props = { params: { id: string } };

export default function ConsignmentDetailPage({ params }: Props) {
  const consignment = MOCK_CONSIGNMENTS.find((c) => c.id === params.id);
  if (!consignment) return notFound();

  // Derived values from items
  const strategies = Array.from(
    new Set(consignment.items.map((it) => it.listing_strategy)),
  );
  const strategyDisplay = strategies.length === 1 ? strategies[0] : "Mixed";
  const estimatedValue = consignment.items.reduce(
    (sum, it) => sum + it.units * it.unitprice,
    0,
  );
  const realizedValue = consignment.items.reduce(
    (sum, it) => sum + (it.paidOutISK ?? 0),
    0,
  );
  const leftToSell = Math.max(0, estimatedValue - realizedValue);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {consignment.title}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {consignment.hub} • Strategy {strategyDisplay}
        </p>
      </div>

      <div className="grid gap-2 text-sm">
        <div>Estimated: {formatISK(estimatedValue)}</div>
        <div>Realized: {formatISK(realizedValue)}</div>
        <div>Left to sell: {formatISK(leftToSell)}</div>
        <div>Created: {new Date(consignment.createdAt).toLocaleString()}</div>
      </div>
    </div>
  );
}
