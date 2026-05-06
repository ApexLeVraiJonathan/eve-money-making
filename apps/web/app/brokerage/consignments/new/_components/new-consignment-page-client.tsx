"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "@eve/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { consignmentsQueryKey, createConsignment } from "../../../_mock/store";
import { formatISK, type Consignment, type ConsignmentItem } from "../../../_mock/data";
import {
  generateCode,
  mapHubToRecipient,
  STRATEGIES,
  type Hub,
  type ImportedItem,
  type Strategy,
} from "./lib/consignment-form-utils";
import { ConsignmentConfigPanel } from "./sections/consignment-config-panel";
import { ConsignmentItemsTable } from "./sections/consignment-items-table";
import { ContractSettingsDialog } from "./sections/contract-settings-dialog";
import { ImportItemsDialog } from "./sections/import-items-dialog";
import { SubmitConsignmentBar } from "./sections/submit-consignment-bar";

export function NewConsignmentPageClient() {
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
      const mappedItems: ConsignmentItem[] = items.map((item) => ({
        type_name: item.name,
        units: item.units,
        unitprice: item.unitPrice,
        listing_strategy: item.strategyCode,
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
        (sum, item) => sum + item.units * item.unitprice,
        0,
      );
      toast.success("Consignment created", {
        description: `${created.title} • ${created.hub} • Estimated ${formatISK(
          estimate,
        )}`,
      });
      setSubmitOpen(false);
    },
    onError: () => {
      toast.error("Failed to create consignment");
    },
  });

  const canSubmit = title.length > 0 && items.length > 0;

  function handleItemsImported(importedItems: ImportedItem[]) {
    setItems((prev) => [...prev, ...importedItems]);
    setImportText("");
    setImportOpen(false);
  }

  function handleUnitPriceChange(index: number, value: string) {
    const unitPrice = Number(value.replace(/[,]/g, ""));
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
      };
      return copy;
    });
  }

  function handleStrategyCodeChange(index: number, strategyCode: string) {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        strategyCode,
      };
      return copy;
    });
  }

  async function handleCopyAvailability() {
    await navigator.clipboard.writeText(mapHubToRecipient(hub));
    toast.success("Availability copied");
  }

  async function handleCopyDescription() {
    if (!submitCode) {
      return;
    }

    await navigator.clipboard.writeText(String(submitCode));
    toast.success("Description copied");
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          New Consignment
        </h1>
        <Link href="/brokerage/consignments" className="text-sm underline">
          Back to list
        </Link>
      </div>

      <div className="grid items-start gap-6 md:grid-cols-3">
        <ConsignmentConfigPanel
          title={title}
          onTitleChange={setTitle}
          hub={hub}
          onHubChange={setHub}
          strategy={strategy}
          onStrategyChange={setStrategy}
          itemCount={items.length}
          onImportClick={() => setImportOpen(true)}
          onClearItemsClick={() => setItems([])}
        />

        <ConsignmentItemsTable
          items={items}
          onUnitPriceChange={handleUnitPriceChange}
          onStrategyCodeChange={handleStrategyCodeChange}
        />
      </div>

      <ImportItemsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        importText={importText}
        onImportTextChange={setImportText}
        strategyCode={strategy.code}
        onItemsImported={handleItemsImported}
      />

      <SubmitConsignmentBar
        canSubmit={canSubmit}
        onSubmitClick={() => {
          setSubmitCode(generateCode());
          setSubmitOpen(true);
        }}
      />

      <ContractSettingsDialog
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        hub={hub}
        submitCode={submitCode}
        onCopyAvailability={handleCopyAvailability}
        onCopyDescription={handleCopyDescription}
        onConfirm={() => createMutation.mutate()}
        confirmDisabled={!canSubmit || createMutation.isPending}
        confirmPending={createMutation.isPending}
      />
    </div>
  );
}
