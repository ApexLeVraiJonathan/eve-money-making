import Link from "next/link";
import { Handshake } from "lucide-react";

export default function BrokerageHome() {
  return (
    <div className="p-6 space-y-8">
      {/* Hero */}
      <section className="rounded-lg border bg-card p-6">
        <h1 className="text-2xl font-semibold tracking-tight inline-flex items-center gap-3">
          {/* Handshake icon accent */}
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Handshake className="h-6 w-6" />
          </span>
          Brokerage
        </h1>
        <p className="mt-2 max-w-3xl">
          A hands-off selling service for EVE Online. You hand over items; we
          list, sell, and remit proceeds minus a brokerage fee.
        </p>
        <div className="mt-4 flex gap-3 text-sm items-center">
          <Link
            href="/brokerage/consignments/new"
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:opacity-90"
          >
            Get started
          </Link>
          <span className="text-muted-foreground">•</span>
          <Link
            href="/brokerage/consignments"
            className="underline underline-offset-4"
          >
            Browse your consignments
          </Link>
          <span className="text-muted-foreground">•</span>
          <Link
            href="/brokerage/reports"
            className="underline underline-offset-4"
          >
            View reports
          </Link>
        </div>
      </section>

      {/* Three-up intro */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-md border p-4 surface-1">
          <h2 className="text-base font-medium">What you can do</h2>
          <ul className="list-disc pl-6 mt-2 space-y-1 text-sm">
            <li>Consign items to hubs (Jita 4-4 or C-N)</li>
            <li>Choose a listing strategy that fits your goals</li>
            <li>Track payouts as items sell</li>
          </ul>
        </div>
        <div className="rounded-md border p-4 surface-1">
          <h2 className="text-base font-medium">How it works</h2>
          <ol className="list-decimal pl-6 mt-2 space-y-1 text-sm">
            <li>Create a consignment with items and target hub</li>
            <li>Deliver items via Item Exchange (no collateral)</li>
            <li>We list, monitor, reprice, and pay out daily</li>
          </ol>
        </div>
        <div className="rounded-md border p-4 surface-1">
          <h2 className="text-base font-medium">Project plan</h2>
          <p className="text-sm mt-2">
            See the working document for scope, workflow, and open questions.
          </p>
          <Link
            className="text-sm underline underline-offset-4 mt-2 inline-block"
            href="/docs/brokerage"
          >
            View Brokerage project doc
          </Link>
        </div>
      </section>
    </div>
  );
}
