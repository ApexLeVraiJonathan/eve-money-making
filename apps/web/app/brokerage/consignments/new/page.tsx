"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
// Checkbox not currently used
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ClipboardCopy } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { consignmentsQueryKey, createConsignment } from "../../_mock/store";
import {
  formatISK,
  type Consignment,
  type ConsignmentItem,
} from "../../_mock/data";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";

const HUBS = ["Jita 4-4", "C-N"] as const;
const STRATEGIES = [
  {
    code: "A",
    label: "Client fixed price",
    fee: 2,
    help: "You set a fixed price; no updates.",
  },
  {
    code: "B",
    label: "Cheapest sell order (no updates)",
    fee: 2.5,
    help: "List at current cheapest sell, never reprice.",
  },
  {
    code: "C",
    label: "Cheapest sell order (updates 1x/day)",
    fee: 3,
    help: "Reprice to cheapest once per day.",
  },
  {
    code: "D",
    label: "Cheapest sell order (updates 2x/day)",
    fee: 3.5,
    help: "Reprice to cheapest twice per day.",
  },
  {
    code: "E",
    label: "Cheapest sell order (updates 3x/day)",
    fee: 4,
    help: "Reprice to cheapest three times per day.",
  },
] as const;

type Strategy = (typeof STRATEGIES)[number];
type Hub = (typeof HUBS)[number];

type ImportedItem = {
  name: string;
  units: number;
  unitPrice: number;
  strategyCode: string;
};

function mapHubToRecipient(hub: Hub): string {
  return hub === "Jita 4-4" ? "LeVraiTrader" : "LeVraiMindTrader05";
}

function generateCode(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback simple UUID v4-like generator
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function randomUnitPrice(): number {
  const min = 100_000;
  const max = 500_000;
  return Math.floor(min + Math.random() * (max - min + 1));
}

const SALES_TAX_PCT = 3.37;
const BROKER_FEE_PCT = 1.5;

function estimateNetForItem(item: ImportedItem): number {
  const gross = item.units * item.unitPrice;
  const s =
    STRATEGIES.find((x) => x.code === item.strategyCode) ?? STRATEGIES[0];
  const totalFeePct = SALES_TAX_PCT + BROKER_FEE_PCT + s.fee;
  return Math.max(0, Math.floor(gross * (1 - totalFeePct / 100)));
}

function totalFeePercent(item: ImportedItem): number {
  const s =
    STRATEGIES.find((x) => x.code === item.strategyCode) ?? STRATEGIES[0];
  return SALES_TAX_PCT + BROKER_FEE_PCT + s.fee;
}

function feeAmount(item: ImportedItem): number {
  const gross = item.units * item.unitPrice;
  return Math.max(0, Math.floor(gross * (totalFeePercent(item) / 100)));
}

export default function NewConsignmentPage() {
  const [title, setTitle] = useState("");
  const [hub, setHub] = useState<Hub>("Jita 4-4");
  const [strategy, setStrategy] = useState<Strategy>(STRATEGIES[2]);
  const [items, setItems] = useState<ImportedItem[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitCode, setSubmitCode] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async () => {
      const newId = `C-${Math.floor(1000 + Math.random() * 9000)}`;
      const mappedItems: ConsignmentItem[] = items.map((it) => ({
        type_name: it.name,
        units: it.units,
        unitprice: it.unitPrice,
        listing_strategy: it.strategyCode,
        unitsSold: 0,
        paidOutISK: 0,
      }));
      const consignment: Consignment = {
        id: newId,
        title: title || `Consignment ${newId}`,
        createdAt: new Date().toISOString(),
        hub,
        items: mappedItems,
        status: "Awaiting-Contract",
      };
      return createConsignment(consignment);
    },
    onSuccess: async (created: Consignment) => {
      await queryClient.invalidateQueries({ queryKey: consignmentsQueryKey });
      const estimate = created.items.reduce(
        (sum, it) => sum + it.units * it.unitprice,
        0
      );
      toast.success("Consignment created", {
        description: `${created.title} • ${created.hub} • Estimated ${formatISK(
          estimate
        )}`,
      });
      setSubmitOpen(false);
    },
    onError: () => {
      toast.error("Failed to create consignment");
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          New Consignment
        </h1>
        <Link href="/brokerage/consignments" className="text-sm underline">
          Back to list
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-3 items-start">
        <div className="grid gap-4 md:col-span-1 self-start surface-1 rounded-md border p-4">
          <div className="grid gap-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <Label className="mb-0">Title</Label>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setImportOpen(true)}
                >
                  Import Item List
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setItems([])}
                  disabled={items.length === 0}
                >
                  Clear items
                </Button>
              </div>
            </div>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Cruiser fits batch"
            />
          </div>

          <div className="grid gap-1 text-sm">
            <Label>Hub</Label>
            <select
              className="border rounded-md px-3 h-9 bg-transparent"
              value={hub}
              onChange={(e) => setHub(e.target.value as Hub)}
            >
              {HUBS.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2 text-sm">
            <Label>Listing strategy</Label>
            <ul className="grid gap-2">
              {STRATEGIES.map((s) => {
                const checked = strategy.code === s.code;
                return (
                  <li
                    key={s.code}
                    className={`rounded-md border p-2 ${
                      checked ? "ring-2 ring-primary" : ""
                    }`}
                  >
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="strategy"
                        checked={checked}
                        onChange={() => setStrategy(s)}
                        className="mt-1 accent-yellow-500"
                      />
                      <span className="flex flex-col text-left">
                        <span className="text-foreground/90 font-medium">
                          {s.label} — Fee {s.fee}% (Code {s.code})
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {s.help}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Removed per UX feedback: overall consignment fee label was not useful */}

          <div className="flex gap-2">
            <Dialog open={importOpen} onOpenChange={setImportOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Import items from EVE inventory</DialogTitle>
                  <DialogDescription>
                    Paste either of the two formats. We'll extract Name and
                    Quantity.
                  </DialogDescription>
                </DialogHeader>
                <Textarea
                  className="mt-3 h-48"
                  placeholder={
                    "Caldari Navy Ballistic Control System\t4\nPithum A-Type Medium Shield Booster\t1\n\nCompact Electronics\t31\tNamed Components\t\t\t0.03 m3\t126,852.93 ISK"
                  }
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                />
                <div className="mt-3 flex items-center justify-between gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setImportOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      const parsed: ImportedItem[] = [];
                      importText
                        .split(/\r?\n/)
                        .map((l) => l.trim())
                        .filter(Boolean)
                        .forEach((line) => {
                          // Two supported formats:
                          // 1) "Name\tQty" or "Name  <spaces>  Qty"
                          // 2) "Name\tQty\t...other cols..."
                          const cols = line.split(/\t+/);
                          if (cols.length >= 2) {
                            const name = cols[0].trim();
                            const qty = Number(cols[1].replace(/[,]/g, ""));
                            if (name && Number.isFinite(qty)) {
                              parsed.push({
                                name,
                                units: Math.max(0, Math.floor(qty)),
                                unitPrice: randomUnitPrice(),
                                strategyCode: strategy.code,
                              });
                              return;
                            }
                          }
                          // Fallback: split on 2+ spaces and take last token as qty
                          const parts = line.split(/\s{2,}/).filter(Boolean);
                          if (parts.length >= 2) {
                            const qty = Number(
                              parts[parts.length - 1].replace(/[,]/g, "")
                            );
                            const name = parts
                              .slice(0, parts.length - 1)
                              .join(" ");
                            if (name && Number.isFinite(qty)) {
                              parsed.push({
                                name,
                                units: Math.max(0, Math.floor(qty)),
                                unitPrice: randomUnitPrice(),
                                strategyCode: strategy.code,
                              });
                            }
                          }
                        });
                      if (parsed.length > 0) {
                        setItems((prev) => [...prev, ...parsed]);
                        setImportText("");
                        setImportOpen(false);
                      }
                    }}
                  >
                    Add to table
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Legend removed; information is integrated with the checkbox list above */}
        </div>

        <div className="overflow-x-auto md:col-span-2 min-w-0 surface-1 rounded-md border p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item Name</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead className="text-right">Unit price (ISK)</TableHead>
                <TableHead>Listing strategy</TableHead>
                <TableHead className="text-right">Fees (ISK)</TableHead>
                <TableHead className="text-right">Est. net (ISK)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground"
                  >
                    No items yet. Import a list to get started.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((it, idx) => (
                  <TableRow key={`${it.name}-${idx}`}>
                    <TableCell>
                      <div className="font-medium">{it.name}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      {it.units.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        className="h-8 text-right w-32"
                        value={it.unitPrice ? it.unitPrice : ""}
                        onChange={(e) => {
                          const v = Number(e.target.value.replace(/[,]/g, ""));
                          setItems((prev) => {
                            const copy = [...prev];
                            copy[idx] = {
                              ...copy[idx],
                              unitPrice: Number.isFinite(v) ? v : 0,
                            };
                            return copy;
                          });
                        }}
                        placeholder="0"
                      />
                    </TableCell>
                    <TableCell>
                      <select
                        className="border rounded-md px-2 h-8 bg-transparent"
                        value={it.strategyCode}
                        onChange={(e) => {
                          setItems((prev) => {
                            const copy = [...prev];
                            copy[idx] = {
                              ...copy[idx],
                              strategyCode: e.target.value,
                            };
                            return copy;
                          });
                        }}
                      >
                        {STRATEGIES.map((s) => (
                          <option key={s.code} value={s.code}>
                            {s.code}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell className="text-right text-yellow-500">
                      {it.unitPrice > 0
                        ? `${feeAmount(it).toLocaleString()} (${totalFeePercent(
                            it
                          ).toFixed(2)}%)`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right text-emerald-500">
                      {it.unitPrice > 0
                        ? estimateNetForItem(it).toLocaleString()
                        : "—"}
                      {" ISK"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {items.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4} className="text-right font-medium">
                    Total
                  </TableCell>
                  <TableCell className="text-right font-medium text-yellow-500">
                    {items
                      .reduce(
                        (sum, it) =>
                          sum + (it.unitPrice > 0 ? feeAmount(it) : 0),
                        0
                      )
                      .toLocaleString()}{" "}
                    ISK
                  </TableCell>
                  <TableCell className="text-right font-medium text-emerald-500">
                    {items
                      .reduce(
                        (sum, it) =>
                          sum + (it.unitPrice > 0 ? estimateNetForItem(it) : 0),
                        0
                      )
                      .toLocaleString()}{" "}
                    ISK
                  </TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 -mx-6 border-t bg-background/80 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={() => {
              setSubmitCode(generateCode());
              setSubmitOpen(true);
            }}
            disabled={!title || items.length === 0}
          >
            Submit Consignment
          </Button>
          <span className="text-xs text-muted-foreground">
            Make sure title and items are filled before submitting.
          </span>
        </div>
      </div>

      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contract Settings</DialogTitle>
            <DialogDescription>
              Create an Item Exchange contract with the following fields.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-md border surface-2 p-3">
              <div className="text-xs text-muted-foreground">
                Contract type:
              </div>
              <div className="mt-1">Item Exchange</div>
            </div>
            <div className="rounded-md border surface-2 p-3">
              <div className="text-xs text-muted-foreground">Availability:</div>
              <div className="mt-1 flex items-center gap-2">
                <span>{mapHubToRecipient(hub)}</span>
                <Button
                  aria-label="Copy availability"
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    await navigator.clipboard.writeText(mapHubToRecipient(hub));
                    toast.success("Availability copied");
                  }}
                >
                  <ClipboardCopy />
                </Button>
              </div>
            </div>
            <div className="rounded-md border surface-2 p-3">
              <div className="text-xs text-muted-foreground">Expiration:</div>
              <div className="mt-1">2 Weeks</div>
            </div>
            <div className="rounded-md border surface-2 p-3">
              <div className="text-xs text-muted-foreground">Description:</div>
              <div className="mt-1 flex items-center gap-2">
                <code className="rounded bg-muted px-2 py-1 text-sm">
                  {submitCode}
                </code>
                <Button
                  aria-label="Copy description"
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    if (!submitCode) return;
                    await navigator.clipboard.writeText(String(submitCode));
                    toast.success("Description copied");
                  }}
                >
                  <ClipboardCopy />
                </Button>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => createMutation.mutate()}
                disabled={
                  !title || items.length === 0 || createMutation.isPending
                }
              >
                {createMutation.isPending ? "Creating…" : "Confirm"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
