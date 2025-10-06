"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCaption,
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
  return hub === "Jita 4-4" ? "LevraiTrader" : "LeVraiMindTrader05";
}

function generateCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++)
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
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

      <div className="grid gap-6 md:grid-cols-3">
        <div className="grid gap-4 md:col-span-1">
          <div className="grid gap-1 text-sm">
            <Label className="text-muted-foreground">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Cruiser fits batch"
            />
          </div>

          <div className="grid gap-1 text-sm">
            <Label className="text-muted-foreground">Hub</Label>
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

          <div className="grid gap-1 text-sm">
            <Label className="text-muted-foreground">Listing strategy</Label>
            <select
              className="border rounded-md px-3 h-9 bg-transparent"
              value={strategy.label}
              onChange={(e) =>
                setStrategy(
                  STRATEGIES.find((s) => s.label === e.target.value) ??
                    STRATEGIES[0]
                )
              }
            >
              {STRATEGIES.map((s) => (
                <option key={s.label} value={s.label}>
                  {s.label} — Fee {s.fee}% (Code {s.code})
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">
              {strategy.help}
            </span>
          </div>

          <div className="text-sm text-muted-foreground">
            Estimated fee for this consignment: <b>{strategy.fee}%</b>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setImportOpen(true)}
            >
              Import Item List
            </Button>
            <Sheet open={importOpen} onOpenChange={setImportOpen}>
              <SheetContent side="right">
                <SheetHeader>
                  <SheetTitle>Import items from EVE inventory</SheetTitle>
                  <SheetDescription>
                    Paste lines like: "Item Name&lt;SPACE&gt;Quantity"
                  </SheetDescription>
                </SheetHeader>
                <Textarea
                  className="mt-3 h-48"
                  placeholder={
                    "Caldari Navy Ballistic Control System\t4\nPithum A-Type Medium Shield Booster\t1"
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
                          const parts = line
                            .split(/\t+|\s{2,}/)
                            .filter(Boolean);
                          if (parts.length >= 2) {
                            const qty = Number(
                              parts[parts.length - 1].replace(/[,]/g, "")
                            );
                            const name = parts
                              .slice(0, parts.length - 1)
                              .join(" ");
                            if (Number.isFinite(qty) && name) {
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
              </SheetContent>
            </Sheet>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setItems([])}
              disabled={items.length === 0}
            >
              Clear items
            </Button>
          </div>

          <div className="mt-2 rounded-md border p-3 text-xs text-muted-foreground">
            <div className="font-medium text-foreground mb-2">
              Listing strategy legend
            </div>
            <ul className="grid gap-2">
              {STRATEGIES.map((s) => (
                <li key={s.code} className="flex items-center">
                  <span className="inline-flex w-6 h-6 items-center justify-center rounded-md border mr-2 text-foreground text-xs">
                    {s.code}
                  </span>
                  <span className="text-foreground/90">{s.label}</span>
                  <span className="ml-1">— Fee {s.fee}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="overflow-x-auto md:col-span-2">
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

      <Sheet open={submitOpen} onOpenChange={setSubmitOpen}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Finalize consignment</SheetTitle>
            <SheetDescription>
              Please ensure the items are delivered to <b>{hub}</b>. Send an
              Item Exchange contract to <b>{mapHubToRecipient(hub)}</b>.
            </SheetDescription>
          </SheetHeader>
          <div className="text-sm mt-2">
            Include this code in the contract description:
            <div className="mt-2 flex items-center gap-2">
              <code className="rounded bg-muted px-2 py-1 text-sm">
                {submitCode}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  submitCode && navigator.clipboard.writeText(submitCode || "")
                }
              >
                Copy
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
