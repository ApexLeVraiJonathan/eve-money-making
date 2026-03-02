"use client";

import * as React from "react";
import { toast } from "@eve/ui";
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
} from "../../../api";
import type { Cycle } from "@eve/shared/tradecraft-cycles";
import { normalizeIsk, toDatetimeLocal } from "./lib/cycle-utils";
import {
  buildCycleUpdatePayload,
  resolvePlanStartDate,
  runToastAction,
} from "./lib/cycles-page-helpers";
import { CycleCreationCard } from "./sections/cycle-creation-card";
import { CyclesListCard } from "./sections/cycles-list-card";
import { CapitalCard } from "./sections/capital-card";

export default function CyclesPageClient() {
  const { data: cycles = [], isLoading: isCyclesLoading } = useCycles();

  const createCycleMutation = useCreateCycle();
  const planCycleMutation = usePlanCycle();
  const openCycleMutation = useOpenCycle();
  const closeCycleMutation = useCloseCycle();
  const updateCycleMutation = useUpdateCycle();
  const deleteCycleMutation = useDeleteCycle();
  const allocateMutation = useAllocateCycleTransactions();

  const [planName, setPlanName] = React.useState("");
  const [planInitialInjection, setPlanInitialInjection] = React.useState<string>("");
  const [planStart, setPlanStart] = React.useState<string>("");

  const [startName, setStartName] = React.useState("");
  const [startInitialInjection, setStartInitialInjection] = React.useState<string>("");

  const [viewingCapitalFor, setViewingCapitalFor] = React.useState<string>("");
  const [editingCycle, setEditingCycle] = React.useState<Cycle | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editStartedAt, setEditStartedAt] = React.useState("");
  const [editInitialInjection, setEditInitialInjection] = React.useState("");

  const { data: capital, refetch: refetchCapital } = useCycleCapital(viewingCapitalFor, false);

  const loading =
    createCycleMutation.isPending ||
    planCycleMutation.isPending ||
    openCycleMutation.isPending ||
    closeCycleMutation.isPending ||
    updateCycleMutation.isPending ||
    deleteCycleMutation.isPending ||
    allocateMutation.isPending;

  const startCycle = async () => {
    await runToastAction({
      action: () =>
        createCycleMutation.mutateAsync({
        name: startName || undefined,
        startedAt: new Date().toISOString(),
        initialInjectionIsk: normalizeIsk(startInitialInjection) ?? undefined,
        }),
      successMessage: "Cycle started",
      onSuccess: () => {
        setStartName("");
        setStartInitialInjection("");
      },
    });
  };

  const planCycle = async () => {
    const startDate = resolvePlanStartDate(planStart);
    if (!startDate) {
      toast.error("Invalid date format");
      return;
    }

    await runToastAction({
      action: () =>
        planCycleMutation.mutateAsync({
        name: planName || undefined,
        startedAt: startDate.toISOString(),
        initialInjectionIsk: normalizeIsk(planInitialInjection) ?? undefined,
        }),
      successMessage: "Cycle planned",
      onSuccess: () => {
        setPlanName("");
        setPlanInitialInjection("");
        setPlanStart("");
      },
    });
  };

  const closeCycle = async (id: string) => {
    await runToastAction({
      action: () => closeCycleMutation.mutateAsync(id),
      successMessage: "Cycle closed",
    });
  };

  const openPlanned = async (id: string) => {
    await runToastAction({
      action: () =>
        openCycleMutation.mutateAsync({ cycleId: id, startedAt: undefined }),
      successMessage: "Cycle opened",
    });
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
    const payload = buildCycleUpdatePayload({
      cycle: editingCycle,
      editName,
      editStartedAt,
      editInitialInjection,
    });

    await runToastAction({
      action: () =>
        updateCycleMutation.mutateAsync({
          cycleId: editingCycle.id,
          data: payload,
        }),
      successMessage: "Cycle updated",
      onSuccess: () => {
        setEditingCycle(null);
      },
    });
  };

  const doDelete = async (cycleId: string) => {
    await runToastAction({
      action: () => deleteCycleMutation.mutateAsync(cycleId),
      successMessage: "Cycle deleted",
    });
  };

  const doAllocate = async (cycleId: string) => {
    await runToastAction({
      action: () => allocateMutation.mutateAsync(cycleId),
      successMessage: "Allocation complete",
    });
  };

  const copyCycleId = async (id: string) => {
    await runToastAction({
      action: () => navigator.clipboard.writeText(id),
      successMessage: "Cycle ID copied",
      errorMessage: "Could not copy to clipboard",
    });
  };

  return (
    <div className="container mx-auto max-w-8xl p-6 space-y-6">
      <CycleCreationCard
        loading={loading}
        planName={planName}
        setPlanName={setPlanName}
        planInitialInjection={planInitialInjection}
        setPlanInitialInjection={setPlanInitialInjection}
        planStart={planStart}
        setPlanStart={setPlanStart}
        startName={startName}
        setStartName={setStartName}
        startInitialInjection={startInitialInjection}
        setStartInitialInjection={setStartInitialInjection}
        onPlan={() => void planCycle()}
        onStart={() => void startCycle()}
      />

      <CyclesListCard
        cycles={cycles}
        isCyclesLoading={isCyclesLoading}
        loading={loading}
        editingCycleId={editingCycle?.id ?? null}
        openPlanned={(id) => void openPlanned(id)}
        doAllocate={(id) => void doAllocate(id)}
        closeCycle={(id) => void closeCycle(id)}
        loadCapital={loadCapital}
        copyCycleId={(id) => void copyCycleId(id)}
        openEdit={openEdit}
        closeEdit={() => setEditingCycle(null)}
        editName={editName}
        setEditName={setEditName}
        editStartedAt={editStartedAt}
        setEditStartedAt={setEditStartedAt}
        editInitialInjection={editInitialInjection}
        setEditInitialInjection={setEditInitialInjection}
        saveEdit={() => void saveEdit()}
        doDelete={(id) => void doDelete(id)}
      />

      <CapitalCard capital={capital} onRecompute={(id) => loadCapital(id, true)} />
    </div>
  );
}
