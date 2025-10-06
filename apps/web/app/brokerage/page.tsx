export default function BrokerageHome() {
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Brokerage</h1>
        <p className="text-muted-foreground mt-2">
          A hands-off selling service for EVE Online. You hand over items; we
          list, sell, and remit proceeds minus a brokerage fee.
        </p>
      </div>
      <div className="space-y-2">
        <h2 className="text-lg font-medium">What this app will cover</h2>
        <ul className="list-disc pl-6 space-y-1 text-sm text-muted-foreground">
          <li>Consignment intake: items, quantities, locations</li>
          <li>Valuation: fair market estimates and expected ranges</li>
          <li>Listing & sale strategy: markets, repricing, timing</li>
          <li>Settlement: fees, taxes, net to client, payouts</li>
        </ul>
      </div>
      <div className="space-y-2">
        <h2 className="text-lg font-medium">Project plan</h2>
        <p className="text-sm text-muted-foreground">
          See the working project document for scope, workflow, and open
          questions.
        </p>
        <a
          className="text-sm underline underline-offset-4"
          href="/docs/brokerage"
        >
          View Brokerage project doc
        </a>
      </div>
      <div className="space-y-2">
        <h2 className="text-lg font-medium">How it works</h2>
        <ol className="list-decimal pl-6 space-y-1 text-sm text-muted-foreground">
          <li>
            Create a consignment with items and target hub (Jita 4-4 or C-N).
          </li>
          <li>
            Choose a listing strategy (speed-first options adjust the fee).
          </li>
          <li>
            Deliver items via Item Exchange to the selected hub (no collateral).
          </li>
          <li>We list, monitor, and reprice per your strategy.</li>
          <li>
            Daily payouts for realized sales; cancel anytime (listing fees
            apply).
          </li>
        </ol>
      </div>
    </div>
  );
}
