import { Recycle } from "lucide-react";

export function CyclesPageHeader() {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
        <Recycle className="h-6 w-6" />
      </span>
      <h1 className="text-2xl font-semibold tracking-tight">Cycles</h1>
    </div>
  );
}
