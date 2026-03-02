import { Loader2 } from "lucide-react";
import { formatIsk } from "@/lib/utils";
import { useNpcMarketSnapshotLatest, type NpcMarketOrder } from "../../../../api";
import { computeExpiresAt, formatIso } from "../lib/market-utils";

export function NpcTypeOrdersExpanded(props: {
  stationId: number;
  typeId: number;
  side: "ALL" | "BUY" | "SELL";
  limit: number;
}) {
  const q = useNpcMarketSnapshotLatest({
    stationId: props.stationId,
    limit: props.limit,
    side: props.side,
    typeId: props.typeId,
  });

  const orders = q.data?.orders ?? [];
  const sell = orders
    .filter((o: NpcMarketOrder) => !o.is_buy_order)
    .slice()
    .sort((a, b) => a.price - b.price);
  const buy = orders
    .filter((o: NpcMarketOrder) => o.is_buy_order)
    .slice()
    .sort((a, b) => b.price - a.price);

  const matched = q.data?.matchedOrders ?? q.data?.filteredOrders ?? null;
  const shown = q.data?.filteredOrders ?? null;

  return (
    <div className="space-y-3">
      {q.isLoading ? (
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading type orders…
        </div>
      ) : q.data ? (
        <>
          <div className="text-xs text-muted-foreground">
            Matched: {matched ?? "—"} · Shown: {shown ?? "—"} (limit {props.limit})
          </div>

          <div>
            <div className="mb-2 text-sm font-medium">Sell orders (low → high)</div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="p-2">Price</th>
                    <th className="p-2">Remain/Total</th>
                    <th className="p-2">Order</th>
                    <th className="p-2">Issued</th>
                    <th className="p-2">Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {sell.map((o) => (
                    <tr key={o.order_id} className="border-t">
                      <td className="p-2 font-mono">{formatIsk(o.price)}</td>
                      <td className="p-2 font-mono">
                        {o.volume_remain}/{o.volume_total}
                      </td>
                      <td className="p-2 font-mono">{o.order_id}</td>
                      <td className="p-2 font-mono">{formatIso(o.issued)}</td>
                      <td className="p-2 font-mono">{formatIso(computeExpiresAt(o))}</td>
                    </tr>
                  ))}
                  {sell.length === 0 ? (
                    <tr className="border-t">
                      <td className="p-3 text-muted-foreground" colSpan={5}>
                        No sell orders in the current slice.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium">Buy orders (high → low)</div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="p-2">Price</th>
                    <th className="p-2">Remain/Total</th>
                    <th className="p-2">Order</th>
                    <th className="p-2">Issued</th>
                    <th className="p-2">Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {buy.map((o) => (
                    <tr key={o.order_id} className="border-t">
                      <td className="p-2 font-mono">{formatIsk(o.price)}</td>
                      <td className="p-2 font-mono">
                        {o.volume_remain}/{o.volume_total}
                      </td>
                      <td className="p-2 font-mono">{o.order_id}</td>
                      <td className="p-2 font-mono">{formatIso(o.issued)}</td>
                      <td className="p-2 font-mono">{formatIso(computeExpiresAt(o))}</td>
                    </tr>
                  ))}
                  {buy.length === 0 ? (
                    <tr className="border-t">
                      <td className="p-3 text-muted-foreground" colSpan={5}>
                        No buy orders in the current slice.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="text-sm text-muted-foreground">No data.</div>
      )}
    </div>
  );
}
