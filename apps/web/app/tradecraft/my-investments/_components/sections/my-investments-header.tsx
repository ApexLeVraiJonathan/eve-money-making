import { Wallet } from "lucide-react";

export function MyInvestmentsHeader() {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
        <Wallet className="h-6 w-6" />
      </span>
      <h1 className="text-2xl font-semibold tracking-tight">My Investments</h1>
    </div>
  );
}
