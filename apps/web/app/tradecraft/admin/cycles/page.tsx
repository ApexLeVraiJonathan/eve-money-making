"use client";

import * as React from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast,
} from "@eve/ui";
import {
  useCycles,
  useCreateCycle,
  usePlanCycle,
  useOpenCycle,
  useCloseCycle,
  useCycleCapital,
  useUpdateCycle,
  useDeleteCycle,
  useAllocateCycleTransactions,
} from "../../api";
import type { Cycle } from "@eve/shared";
import { Pencil, Trash2, Copy, RefreshCcw, Play, XCircle } from "lucide-react";

export default function CyclesPage() {
  // Use new API hooks
  const { data: cycles = [], isLoading: isCyclesLoading } = useCycles();

  const createCycleMutation = useCreateCycle();
  const planCycleMutation = usePlanCycle();
  const openCycleMutation = useOpenCycle();
  const closeCycleMutation = useCloseCycle();
  const updateCycleMutation = useUpdateCycle();
  const deleteCycleMutation = useDeleteCycle();
  const allocateMutation = useAllocateCycleTransactions();

  const [planName, setPlanName] = React.useState("");
  const [planInitialInjection, setPlanInitialInjection] =
    React.useState<string>("");
  const [planStart, setPlanStart] = React.useState<string>("");

  const [startName, setStartName] = React.useState("");
  const [startInitialInjection, setStartInitialInjection] =
    React.useState<string>("");

  const [viewingCapitalFor, setViewingCapitalFor] = React.useState<string>("");
  const [editingCycle, setEditingCycle] = React.useState<Cycle | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editStartedAt, setEditStartedAt] = React.useState("");
  const [editInitialInjection, setEditInitialInjection] = React.useState("");

  const { data: capital, refetch: refetchCapital } = useCycleCapital(
    viewingCapitalFor,
    false,
  );

  const loading =
    createCycleMutation.isPending ||
    planCycleMutation.isPending ||
    openCycleMutation.isPending ||
    closeCycleMutation.isPending ||
    updateCycleMutation.isPending ||
    deleteCycleMutation.isPending ||
    allocateMutation.isPending;

  const toDatetimeLocal = React.useCallback((iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, []);

  const normalizeIsk = (raw: string) => {
    const n = Number(raw);
    if (!raw || Number.isNaN(n)) return undefined;
    return n.toFixed(2);
  };

  const startCycle = async () => {
    try {
      await createCycleMutation.mutateAsync({
        name: startName || undefined,
        startedAt: new Date().toISOString(),
        initialInjectionIsk: normalizeIsk(startInitialInjection) ?? undefined,
      });
      setStartName("");
      setStartInitialInjection("");
      toast.success("Cycle started");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const planCycle = async () => {
    try {
      // Convert datetime-local input to ISO string
      let startDate: Date;
      if (planStart && planStart.trim() !== "") {
        startDate = new Date(planStart);
        // Validate the date is valid
        if (isNaN(startDate.getTime())) {
          toast.error("Invalid date format");
          return;
        }
      } else {
        // Default to tomorrow if no date specified
        startDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      }

      await planCycleMutation.mutateAsync({
        name: planName || undefined,
        startedAt: startDate.toISOString(),
        initialInjectionIsk: normalizeIsk(planInitialInjection) ?? undefined,
      });
      setPlanName("");
      setPlanInitialInjection("");
      setPlanStart("");
      toast.success("Cycle planned");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const closeCycle = async (id: string) => {
    try {
      await closeCycleMutation.mutateAsync(id);
      toast.success("Cycle closed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const openPlanned = async (id: string) => {
    try {
      await openCycleMutation.mutateAsync({
        cycleId: id,
        startedAt: undefined,
      });
      toast.success("Cycle opened");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const loadCapital = (cycleId: string, force?: boolean) => {
    setViewingCapitalFor(cycleId);
    if (force) {
      void refetchCapital();
    }
  };

  const openEdit = (c: Cycle) => {
    setEditingCycle(c);
    setEditName(c.name ?? "");
    setEditStartedAt(toDatetimeLocal(c.startedAt));
    setEditInitialInjection(c.initialInjectionIsk ?? "");
  };

  const saveEdit = async () => {
    if (!editingCycle) return;
    const isPlanned = editingCycle.status === "PLANNED";

    const payload: {
      name?: string;
      startedAt?: string;
      initialInjectionIsk?: string;
    } = {};

    if (editName.trim()) payload.name = editName.trim();
    if (!editName.trim() && editingCycle.name) {
      // Name can't be cleared via API right now; keep existing behavior.
      payload.name = editingCycle.name ?? undefined;
    }

    if (isPlanned) {
      const d = new Date(editStartedAt);
      if (!Number.isNaN(d.getTime())) payload.startedAt = d.toISOString();
      const inj = normalizeIsk(editInitialInjection);
      if (typeof inj !== "undefined") payload.initialInjectionIsk = inj;
    }

    try {
      await updateCycleMutation.mutateAsync({
        cycleId: editingCycle.id,
        data: payload,
      });
      toast.success("Cycle updated");
      setEditingCycle(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const doDelete = async (cycleId: string) => {
    try {
      await deleteCycleMutation.mutateAsync(cycleId);
      toast.success("Cycle deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const doAllocate = async (cycleId: string) => {
    try {
      await allocateMutation.mutateAsync(cycleId);
      toast.success("Allocation complete");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const getStatus = (c: Cycle): "Planned" | "Ongoing" | "Completed" => {
    if (c.status === "PLANNED") return "Planned";
    if (c.status === "COMPLETED") return "Completed";
    return "Ongoing"; // OPEN status
  };

  const formatLocal = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleString() : "—";

  const copyCycleId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      toast.success("Cycle ID copied");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  return (
    <div className="container mx-auto max-w-8xl p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cycles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <form
              className="space-y-4 p-4 rounded-md border bg-gradient-to-b from-background to-muted/10"
              onSubmit={(e) => {
                e.preventDefault();
                void planCycle();
              }}
            >
              <div>
                <div className="font-medium">Plan a Cycle</div>
                <div className="text-xs text-muted-foreground mt-1 min-h-[2.5rem]">
                  Schedules a future cycle for opt-ins. If no start date is set,
                  it defaults to tomorrow.
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-12">
                <div className="space-y-1 md:col-span-6">
                  <Label htmlFor="plan-name" className="whitespace-nowrap">
                    Name{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    id="plan-name"
                    placeholder="e.g. Cycle 6"
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                  />
                </div>
                <div className="space-y-1 md:col-span-3">
                  <Label htmlFor="plan-start" className="whitespace-nowrap">
                    Start{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    id="plan-start"
                    type="datetime-local"
                    value={planStart}
                    onChange={(e) => setPlanStart(e.target.value)}
                  />
                </div>
                <div className="space-y-1 md:col-span-3">
                  <Label htmlFor="plan-injection" className="whitespace-nowrap">
                    Injection (ISK)
                  </Label>
                  <Input
                    id="plan-injection"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    placeholder="0"
                    value={planInitialInjection}
                    onChange={(e) => setPlanInitialInjection(e.target.value)}
                  />
                  <div className="text-[11px] text-muted-foreground min-h-4 leading-tight">
                    Leave blank for no injection.
                  </div>
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full md:w-28"
                >
                  Plan
                </Button>
              </div>
            </form>

            <form
              className="space-y-4 p-4 rounded-md border bg-gradient-to-b from-background to-muted/10"
              onSubmit={(e) => {
                e.preventDefault();
                void startCycle();
              }}
            >
              <div>
                <div className="font-medium">Start a Cycle Now</div>
                <div className="text-xs text-muted-foreground mt-1 min-h-[2.5rem]">
                  Creates and opens a cycle immediately using the current time.
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-12">
                <div className="space-y-1 md:col-span-6">
                  <Label htmlFor="start-name" className="whitespace-nowrap">
                    Name{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    id="start-name"
                    placeholder="e.g. Cycle 6"
                    value={startName}
                    onChange={(e) => setStartName(e.target.value)}
                  />
                </div>
                <div className="space-y-1 md:col-span-3">
                  <Label htmlFor="start-now" className="whitespace-nowrap">
                    Start
                  </Label>
                  <Input id="start-now" value="Now" disabled />
                  <div className="text-[11px] text-muted-foreground min-h-4 leading-tight">
                    Uses the current time.
                  </div>
                </div>
                <div className="space-y-1 md:col-span-3">
                  <Label
                    htmlFor="start-injection"
                    className="whitespace-nowrap"
                  >
                    Injection (ISK)
                  </Label>
                  <Input
                    id="start-injection"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    placeholder="0"
                    value={startInitialInjection}
                    onChange={(e) => setStartInitialInjection(e.target.value)}
                  />
                  <div className="text-[11px] text-muted-foreground min-h-4 leading-tight">
                    Leave blank for no injection.
                  </div>
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full md:w-28"
                >
                  Start
                </Button>
              </div>
            </form>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Cycles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isCyclesLoading ? (
            <div className="text-sm text-muted-foreground">Loading cycles…</div>
          ) : cycles.length === 0 ? (
            <div className="text-sm text-muted-foreground">No cycles yet.</div>
          ) : (
            <>
              {/* Mobile: card list so actions never get clipped */}
              <div className="space-y-3 sm:hidden">
                {cycles.map((c) => {
                  const status = getStatus(c);
                  return (
                    <div key={c.id} className="rounded-md border p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {c.name || c.id.slice(0, 8)}
                          </div>
                          <div className="text-xs text-muted-foreground break-all mt-1">
                            {c.id}
                          </div>
                        </div>
                        <Badge
                          variant={
                            status === "Planned"
                              ? "outline"
                              : status === "Completed"
                                ? "secondary"
                                : "default"
                          }
                        >
                          {status}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground">
                            {status === "Planned" ? "Scheduled" : "Started"}
                          </div>
                          <div className="mt-1">{formatLocal(c.startedAt)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">
                            Closed
                          </div>
                          <div className="mt-1">{formatLocal(c.closedAt)}</div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => void openPlanned(c.id)}
                          disabled={loading || status !== "Planned"}
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Open
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => void doAllocate(c.id)}
                          disabled={loading || status !== "Ongoing"}
                        >
                          <RefreshCcw className="h-4 w-4 mr-2" />
                          Allocate
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => void closeCycle(c.id)}
                          disabled={loading || status !== "Ongoing"}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Close
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => void loadCapital(c.id)}
                          disabled={loading}
                        >
                          View Capital
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void copyCycleId(c.id)}
                          disabled={loading}
                          aria-label="Copy cycle ID"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Dialog
                          open={editingCycle?.id === c.id}
                          onOpenChange={(open) =>
                            open ? openEdit(c) : setEditingCycle(null)
                          }
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={loading}
                              aria-label="Edit cycle"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit cycle</DialogTitle>
                              <DialogDescription>
                                {c.status === "PLANNED"
                                  ? "PLANNED cycles can update name, start time, and injection."
                                  : "OPEN/COMPLETED cycles can update name only."}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-2">
                              <div className="space-y-2">
                                <Label>Name</Label>
                                <Input
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  placeholder="Cycle name"
                                />
                              </div>
                              {c.status === "PLANNED" ? (
                                <>
                                  <div className="space-y-2">
                                    <Label>Planned start</Label>
                                    <Input
                                      type="datetime-local"
                                      value={editStartedAt}
                                      onChange={(e) =>
                                        setEditStartedAt(e.target.value)
                                      }
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Initial injection ISK</Label>
                                    <Input
                                      value={editInitialInjection}
                                      onChange={(e) =>
                                        setEditInitialInjection(e.target.value)
                                      }
                                      placeholder="e.g. 10000000.00"
                                    />
                                  </div>
                                </>
                              ) : null}
                            </div>
                            <DialogFooter>
                              <Button
                                variant="secondary"
                                onClick={() => setEditingCycle(null)}
                              >
                                Cancel
                              </Button>
                              <Button
                                onClick={() => void saveEdit()}
                                disabled={loading}
                              >
                                Save
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => void doDelete(c.id)}
                          disabled={loading || status !== "Planned"}
                          aria-label="Delete planned cycle"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop: keep table layout */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-foreground">Cycle</TableHead>
                      <TableHead className="text-foreground">Status</TableHead>
                      <TableHead className="text-foreground">Started</TableHead>
                      <TableHead className="text-foreground">Closed</TableHead>
                      <TableHead className="text-right text-foreground">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cycles.map((c) => {
                      const status = getStatus(c);
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">
                            {c.name || c.id.slice(0, 8)}
                            <div className="text-xs text-muted-foreground">
                              {c.id}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                status === "Planned"
                                  ? "outline"
                                  : status === "Completed"
                                    ? "secondary"
                                    : "default"
                              }
                            >
                              {status}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatLocal(c.startedAt)}</TableCell>
                          <TableCell>{formatLocal(c.closedAt)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => void openPlanned(c.id)}
                                disabled={loading || status !== "Planned"}
                              >
                                <Play className="h-4 w-4 mr-2" />
                                Open
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => void doAllocate(c.id)}
                                disabled={loading || status !== "Ongoing"}
                              >
                                <RefreshCcw className="h-4 w-4 mr-2" />
                                Allocate
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => void closeCycle(c.id)}
                                disabled={loading || status !== "Ongoing"}
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Close
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => void loadCapital(c.id)}
                                disabled={loading}
                              >
                                View Capital
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void copyCycleId(c.id)}
                                disabled={loading}
                                aria-label="Copy cycle ID"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Dialog
                                open={editingCycle?.id === c.id}
                                onOpenChange={(open) =>
                                  open ? openEdit(c) : setEditingCycle(null)
                                }
                              >
                                <DialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={loading}
                                    aria-label="Edit cycle"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Edit cycle</DialogTitle>
                                    <DialogDescription>
                                      {c.status === "PLANNED"
                                        ? "PLANNED cycles can update name, start time, and injection."
                                        : "OPEN/COMPLETED cycles can update name only."}
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4 py-2">
                                    <div className="space-y-2">
                                      <Label>Name</Label>
                                      <Input
                                        value={editName}
                                        onChange={(e) =>
                                          setEditName(e.target.value)
                                        }
                                        placeholder="Cycle name"
                                      />
                                    </div>
                                    {c.status === "PLANNED" ? (
                                      <>
                                        <div className="space-y-2">
                                          <Label>Planned start</Label>
                                          <Input
                                            type="datetime-local"
                                            value={editStartedAt}
                                            onChange={(e) =>
                                              setEditStartedAt(e.target.value)
                                            }
                                          />
                                        </div>
                                        <div className="space-y-2">
                                          <Label>Initial injection ISK</Label>
                                          <Input
                                            value={editInitialInjection}
                                            onChange={(e) =>
                                              setEditInitialInjection(
                                                e.target.value,
                                              )
                                            }
                                            placeholder="e.g. 10000000.00"
                                          />
                                        </div>
                                      </>
                                    ) : null}
                                  </div>
                                  <DialogFooter>
                                    <Button
                                      variant="secondary"
                                      onClick={() => setEditingCycle(null)}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      onClick={() => void saveEdit()}
                                      disabled={loading}
                                    >
                                      Save
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => void doDelete(c.id)}
                                disabled={loading || status !== "Planned"}
                                aria-label="Delete planned cycle"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {capital && (
        <Card>
          <CardHeader>
            <CardTitle>Capital</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div>
                Total: {Number(capital.capital.total).toLocaleString()} ISK
              </div>
              <div>
                Cash: {Number(capital.capital.cash).toLocaleString()} ISK
              </div>
              <div>
                Inventory: {Number(capital.capital.inventory).toLocaleString()}{" "}
                ISK
              </div>
              <Button
                variant="secondary"
                onClick={() => void loadCapital(capital.cycleId, true)}
                className="sm:ml-auto"
              >
                Recompute
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              As of {new Date(capital.asOf).toLocaleString()} • Split: Cash{" "}
              {capital.capital.percentSplit.cash}% / Inventory{" "}
              {capital.capital.percentSplit.inventory}% • Initial Investment:{" "}
              {capital.initialInvestment ?? "—"}
            </div>
            <div className="mt-2">
              <div className="font-medium">Inventory by station</div>
              <div className="grid grid-cols-1 gap-1">
                {capital.inventoryBreakdown.map((b) => (
                  <div key={b.stationId} className="flex justify-between">
                    <span>
                      {b.stationName} (#{b.stationId})
                    </span>
                    <span>{Number(b.value).toLocaleString()} ISK</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
