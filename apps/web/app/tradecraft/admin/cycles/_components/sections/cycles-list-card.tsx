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
} from "@eve/ui";
import type { Cycle } from "@eve/shared/tradecraft-cycles";
import { Pencil, Trash2, Copy, RefreshCcw, Play, XCircle } from "lucide-react";
import { formatLocal, getStatus } from "../lib/cycle-utils";

function EditCycleDialog({
  cycle,
  loading,
  editingCycleId,
  openEdit,
  closeEdit,
  editName,
  setEditName,
  editStartedAt,
  setEditStartedAt,
  editInitialInjection,
  setEditInitialInjection,
  saveEdit,
}: {
  cycle: Cycle;
  loading: boolean;
  editingCycleId: string | null;
  openEdit: (c: Cycle) => void;
  closeEdit: () => void;
  editName: string;
  setEditName: (value: string) => void;
  editStartedAt: string;
  setEditStartedAt: (value: string) => void;
  editInitialInjection: string;
  setEditInitialInjection: (value: string) => void;
  saveEdit: () => void;
}) {
  return (
    <Dialog
      open={editingCycleId === cycle.id}
      onOpenChange={(open) => (open ? openEdit(cycle) : closeEdit())}
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
            {cycle.status === "PLANNED"
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
          {cycle.status === "PLANNED" ? (
            <>
              <div className="space-y-2">
                <Label>Planned start</Label>
                <Input
                  type="datetime-local"
                  value={editStartedAt}
                  onChange={(e) => setEditStartedAt(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Initial injection ISK</Label>
                <Input
                  value={editInitialInjection}
                  onChange={(e) => setEditInitialInjection(e.target.value)}
                  placeholder="e.g. 10000000.00"
                />
              </div>
            </>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={closeEdit}>
            Cancel
          </Button>
          <Button onClick={saveEdit} disabled={loading}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CyclesListCard({
  cycles,
  isCyclesLoading,
  loading,
  editingCycleId,
  openPlanned,
  allocateTransactions,
  closeCycle,
  loadCapital,
  copyCycleId,
  openEdit,
  closeEdit,
  editName,
  setEditName,
  editStartedAt,
  setEditStartedAt,
  editInitialInjection,
  setEditInitialInjection,
  saveEdit,
  doDelete,
}: {
  cycles: Cycle[];
  isCyclesLoading: boolean;
  loading: boolean;
  editingCycleId: string | null;
  openPlanned: (id: string) => void;
  allocateTransactions: (id: string) => void;
  closeCycle: (id: string) => void;
  loadCapital: (id: string) => void;
  copyCycleId: (id: string) => void;
  openEdit: (c: Cycle) => void;
  closeEdit: () => void;
  editName: string;
  setEditName: (value: string) => void;
  editStartedAt: string;
  setEditStartedAt: (value: string) => void;
  editInitialInjection: string;
  setEditInitialInjection: (value: string) => void;
  saveEdit: () => void;
  doDelete: (id: string) => void;
}) {
  return (
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
                        onClick={() => openPlanned(c.id)}
                        disabled={loading || status !== "Planned"}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Open
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => allocateTransactions(c.id)}
                        disabled={loading || status !== "Ongoing"}
                      >
                        <RefreshCcw className="h-4 w-4 mr-2" />
                        Allocate
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => closeCycle(c.id)}
                        disabled={loading || status !== "Ongoing"}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Close
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => loadCapital(c.id)}
                        disabled={loading}
                      >
                        View Capital
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyCycleId(c.id)}
                        disabled={loading}
                        aria-label="Copy cycle ID"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <EditCycleDialog
                        cycle={c}
                        loading={loading}
                        editingCycleId={editingCycleId}
                        openEdit={openEdit}
                        closeEdit={closeEdit}
                        editName={editName}
                        setEditName={setEditName}
                        editStartedAt={editStartedAt}
                        setEditStartedAt={setEditStartedAt}
                        editInitialInjection={editInitialInjection}
                        setEditInitialInjection={setEditInitialInjection}
                        saveEdit={saveEdit}
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => doDelete(c.id)}
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
                              onClick={() => openPlanned(c.id)}
                              disabled={loading || status !== "Planned"}
                            >
                              <Play className="h-4 w-4 mr-2" />
                              Open
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => allocateTransactions(c.id)}
                              disabled={loading || status !== "Ongoing"}
                            >
                              <RefreshCcw className="h-4 w-4 mr-2" />
                              Allocate
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => closeCycle(c.id)}
                              disabled={loading || status !== "Ongoing"}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Close
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => loadCapital(c.id)}
                              disabled={loading}
                            >
                              View Capital
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyCycleId(c.id)}
                              disabled={loading}
                              aria-label="Copy cycle ID"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <EditCycleDialog
                              cycle={c}
                              loading={loading}
                              editingCycleId={editingCycleId}
                              openEdit={openEdit}
                              closeEdit={closeEdit}
                              editName={editName}
                              setEditName={setEditName}
                              editStartedAt={editStartedAt}
                              setEditStartedAt={setEditStartedAt}
                              editInitialInjection={editInitialInjection}
                              setEditInitialInjection={setEditInitialInjection}
                              saveEdit={saveEdit}
                            />
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => doDelete(c.id)}
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
  );
}
