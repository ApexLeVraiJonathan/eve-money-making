"use client";

import * as React from "react";
import { toast } from "@eve/ui";
import {
  useAllocateCycleTransactions,
  useCloseCycle,
  useCreateCycle,
  useCycleCapital,
  useCycles,
  useDeleteCycle,
  useOpenCycle,
  usePlanCycle,
  useUpdateCycle,
} from "@/app/tradecraft/api/cycles/cycles.hooks";
import type {
  Cycle,
  CycleLifecycleResponse,
  CycleSettlementReport,
} from "@eve/shared/tradecraft-cycles";
import { normalizeIsk, toDatetimeLocal } from "../lib/cycle-utils";
import {
  buildCycleUpdatePayload,
  resolvePlanStartDate,
  runToastAction,
} from "../lib/cycles-page-helpers";

type LastSettlementReport = {
  title: string;
  report: CycleSettlementReport;
};

export function useCycleLifecycleAdmin() {
  const { data: cycles = [], isLoading: isCyclesLoading } = useCycles();

  const createCycleMutation = useCreateCycle();
  const planCycleMutation = usePlanCycle();
  const openCycleMutation = useOpenCycle();
  const closeCycleMutation = useCloseCycle();
  const updateCycleMutation = useUpdateCycle();
  const deleteCycleMutation = useDeleteCycle();
  const allocateMutation = useAllocateCycleTransactions();

  const [planName, setPlanName] = React.useState("");
  const [planInitialInjection, setPlanInitialInjection] = React.useState("");
  const [planStart, setPlanStart] = React.useState("");

  const [startName, setStartName] = React.useState("");
  const [startInitialInjection, setStartInitialInjection] = React.useState("");

  const [viewingCapitalFor, setViewingCapitalFor] = React.useState("");
  const [editingCycle, setEditingCycle] = React.useState<Cycle | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editStartedAt, setEditStartedAt] = React.useState("");
  const [editInitialInjection, setEditInitialInjection] = React.useState("");
  const [lastSettlementReport, setLastSettlementReport] =
    React.useState<LastSettlementReport | null>(null);

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
    let response: CycleLifecycleResponse | null = null;
    await runToastAction({
      action: async () => {
        response = await closeCycleMutation.mutateAsync(id);
      },
      successMessage: "Cycle closed",
      onSuccess: () => {
        if (response) {
          setLastSettlementReport({
            title: "Close Cycle",
            report: response.settlementReport,
          });
        }
      },
    });
  };

  const openPlanned = async (id: string) => {
    let response: CycleLifecycleResponse | null = null;
    await runToastAction({
      action: async () => {
        response = await openCycleMutation.mutateAsync({
          cycleId: id,
          startedAt: undefined,
        });
      },
      successMessage: "Cycle opened",
      onSuccess: () => {
        if (response) {
          setLastSettlementReport({
            title: "Open Planned Cycle",
            report: response.settlementReport,
          });
        }
      },
    });
  };

  const loadCapital = (cycleId: string, force?: boolean) => {
    setViewingCapitalFor(cycleId);
    if (force) {
      void refetchCapital();
    }
  };

  const openEdit = (cycle: Cycle) => {
    setEditingCycle(cycle);
    setEditName(cycle.name ?? "");
    setEditStartedAt(toDatetimeLocal(cycle.startedAt));
    setEditInitialInjection(cycle.initialInjectionIsk ?? "");
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

  const allocateTransactions = async (cycleId: string) => {
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

  return {
    cycles,
    isCyclesLoading,
    loading,
    creationProps: {
      loading,
      planName,
      setPlanName,
      planInitialInjection,
      setPlanInitialInjection,
      planStart,
      setPlanStart,
      startName,
      setStartName,
      startInitialInjection,
      setStartInitialInjection,
      onPlan: () => void planCycle(),
      onStart: () => void startCycle(),
    },
    listProps: {
      cycles,
      isCyclesLoading,
      loading,
      editingCycleId: editingCycle?.id ?? null,
      openPlanned: (id: string) => void openPlanned(id),
      allocateTransactions: (id: string) => void allocateTransactions(id),
      closeCycle: (id: string) => void closeCycle(id),
      loadCapital,
      copyCycleId: (id: string) => void copyCycleId(id),
      openEdit,
      closeEdit: () => setEditingCycle(null),
      editName,
      setEditName,
      editStartedAt,
      setEditStartedAt,
      editInitialInjection,
      setEditInitialInjection,
      saveEdit: () => void saveEdit(),
      doDelete: (id: string) => void doDelete(id),
    },
    settlementReportProps: {
      report: lastSettlementReport?.report ?? null,
      title: lastSettlementReport?.title ?? "",
    },
    capitalProps: {
      capital,
      onRecompute: (id: string) => loadCapital(id, true),
    },
  };
}
