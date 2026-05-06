"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Skeleton } from "@eve/ui";
import { useCycles, useProfitBreakdown, useAddTransportFee, useAddCollateralRecoveryFee } from "../../../api";
import { ProfitStatementSection } from "./sections/profit-statement-section";
import { TransportFeeCard } from "./sections/transport-fee-card";
import { CollateralRecoveryCard } from "./sections/collateral-recovery-card";

export default function CycleProfitPageClient() {
  const searchParams = useSearchParams();
  const queryParamCycleId = searchParams.get("cycleId");

  const [cycleId, setCycleId] = React.useState<string>("");
  const [transportAmount, setTransportAmount] = React.useState<string>("");
  const [transportMemo, setTransportMemo] = React.useState<string>("");
  const [collateralAmount, setCollateralAmount] = React.useState<string>("");
  const [collateralMemo, setCollateralMemo] = React.useState<string>("");
  const [successMessage, setSuccessMessage] = React.useState<string>("");

  const { data: cycles = [] } = useCycles();

  React.useEffect(() => {
    if (queryParamCycleId) {
      setCycleId(queryParamCycleId);
    } else if (cycles.length > 0 && !cycleId) {
      const openCycle = cycles.find((c) => c.status === "OPEN");
      setCycleId(openCycle?.id || cycles[0].id);
    }
  }, [queryParamCycleId, cycles, cycleId]);

  const { data: breakdown, isLoading, error } = useProfitBreakdown(cycleId);
  const addTransportFeeMutation = useAddTransportFee();
  const addCollateralRecoveryFeeMutation = useAddCollateralRecoveryFee();

  const handleAddTransportFee = async () => {
    if (!cycleId || !transportAmount) return;
    const amountNum = parseFloat(transportAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Please enter a valid positive amount");
      return;
    }
    const formattedAmount = amountNum.toFixed(2);

    try {
      await addTransportFeeMutation.mutateAsync({
        cycleId,
        data: { amountIsk: formattedAmount, memo: transportMemo || undefined },
      });
      setTransportAmount("");
      setTransportMemo("");
      setSuccessMessage("Shipping cost recorded successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      alert(
        `Failed to add transport fee: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  const handleAddCollateralRecoveryFee = async () => {
    if (!cycleId || !collateralAmount) return;
    const amountNum = parseFloat(collateralAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Please enter a valid positive amount");
      return;
    }
    const formattedAmount = amountNum.toFixed(2);

    try {
      await addCollateralRecoveryFeeMutation.mutateAsync({
        cycleId,
        data: { amountIsk: formattedAmount, memo: collateralMemo || undefined },
      });
      setCollateralAmount("");
      setCollateralMemo("");
      setSuccessMessage("Collateral recovery recorded successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      alert(
        `Failed to add collateral recovery: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4">
          <p className="text-sm text-red-600 dark:text-red-400">
            {error instanceof Error ? error.message : String(error)}
          </p>
        </div>
      </div>
    );
  }

  if (isLoading || !breakdown) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Profit & Loss Statement</h1>
          {cycleId ? (
            <p className="text-sm text-muted-foreground">
              Loading breakdown for cycle {cycleId.slice(0, 8)}...
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Loading latest open cycle...</p>
          )}
        </div>
        <div className="space-y-4">
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <ProfitStatementSection breakdown={breakdown} cycleId={cycleId} />
      <TransportFeeCard
        transportAmount={transportAmount}
        setTransportAmount={setTransportAmount}
        transportMemo={transportMemo}
        setTransportMemo={setTransportMemo}
        isPending={addTransportFeeMutation.isPending}
        onSubmit={handleAddTransportFee}
        successMessage={successMessage}
        breakdown={breakdown}
      />
      <CollateralRecoveryCard
        collateralAmount={collateralAmount}
        setCollateralAmount={setCollateralAmount}
        collateralMemo={collateralMemo}
        setCollateralMemo={setCollateralMemo}
        isPending={addCollateralRecoveryFeeMutation.isPending}
        onSubmit={handleAddCollateralRecoveryFee}
        successMessage={successMessage}
        breakdown={breakdown}
      />
    </div>
  );
}
