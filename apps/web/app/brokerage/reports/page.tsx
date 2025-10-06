import {
  MOCK_CONSIGNMENTS,
  MOCK_DAILY_PAYOUTS,
  formatISK,
} from "../_mock/data";

export default function BrokerageReportsPage() {
  const consignments = MOCK_CONSIGNMENTS;
  const realized = consignments.reduce((sum, c) => sum + c.realizedValue, 0);
  const left = consignments.reduce((sum, c) => sum + c.leftToSell, 0);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-md border p-4">
          <div className="text-xs text-muted-foreground">Realized</div>
          <div className="text-lg font-medium">{formatISK(realized)}</div>
        </div>
        <div className="rounded-md border p-4">
          <div className="text-xs text-muted-foreground">Left to sell</div>
          <div className="text-lg font-medium">{formatISK(left)}</div>
        </div>
        <div className="rounded-md border p-4">
          <div className="text-xs text-muted-foreground">Consignments</div>
          <div className="text-lg font-medium">{consignments.length}</div>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-medium">
          Current unit sell price (sample)
        </h2>
        <p className="text-sm text-muted-foreground">
          Placeholder; will integrate market pricing per item in a later step.
        </p>
      </div>
      <div className="space-y-2">
        <h2 className="text-lg font-medium">Daily payouts (mock)</h2>
        <div className="grid gap-2 text-sm">
          {MOCK_DAILY_PAYOUTS.map((p) => (
            <div
              key={p.date}
              className="flex items-center justify-between rounded-md border p-3"
            >
              <span className="text-muted-foreground">{p.date}</span>
              <span className="font-medium">{formatISK(p.amount)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
