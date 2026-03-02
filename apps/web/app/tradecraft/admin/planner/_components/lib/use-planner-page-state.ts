import * as React from "react";
import type { PackagePlan, PlanResult } from "@eve/shared/tradecraft-arbitrage";
import {
  useAddTransportFee,
  useCommitArbitrage,
  usePlanArbitrage,
} from "../../../../api";
import {
  COURIER_PRESETS,
  defaultPayload,
  PLANNER_DRAFT_STORAGE_KEY,
} from "./planner-constants";
import type {
  AllocationMode,
  CourierMode,
  PlannerCommitSuccess,
  PlannerRestoredDraft,
} from "./planner-types";
import {
  buildCopyTextByPackage,
  formatNumber,
  groupPackagesByDestination,
  parseFormattedNumber,
} from "./planner-utils";

export function usePlannerPageState() {
  const [json, setJson] = React.useState(JSON.stringify(defaultPayload, null, 2));
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<PlanResult | null>(null);
  const [memo, setMemo] = React.useState("");
  const [commitDialogOpen, setCommitDialogOpen] = React.useState(false);
  const [recordShipping, setRecordShipping] = React.useState(true);
  const [shippingAmount, setShippingAmount] = React.useState<string>("");
  const [shippingMemo, setShippingMemo] = React.useState<string>("");
  const [copiedDest, setCopiedDest] = React.useState<string | null>(null);
  const [commitSuccess, setCommitSuccess] = React.useState<PlannerCommitSuccess | null>(null);
  const [restoredFromDraft, setRestoredFromDraft] = React.useState<PlannerRestoredDraft | null>(
    null,
  );

  const planPackagesMutation = usePlanArbitrage();
  const commitArbitrageMutation = useCommitArbitrage();
  const addTransportFeeMutation = useAddTransportFee();

  const loading = planPackagesMutation.isPending;

  const [capacityDisplay, setCapacityDisplay] = React.useState(
    defaultPayload.packageCapacityM3.toLocaleString(),
  );
  const [investmentDisplay, setInvestmentDisplay] = React.useState(
    defaultPayload.investmentISK.toLocaleString(),
  );
  const [maxPackagesDisplay, setMaxPackagesDisplay] = React.useState(
    defaultPayload.maxPackagesHint.toString(),
  );
  const [shareDisplay, setShareDisplay] = React.useState(
    (defaultPayload.perDestinationMaxBudgetSharePerItem * 100).toString(),
  );
  const [collateralDisplay, setCollateralDisplay] = React.useState(
    defaultPayload.maxPackageCollateralISK.toLocaleString(),
  );

  const [courierMode, setCourierMode] = React.useState<CourierMode>("blockade");
  const [autoBlockadeMaxVolumeM3, setAutoBlockadeMaxVolumeM3] = React.useState<number>(
    COURIER_PRESETS.blockade.maxVolumeM3,
  );
  const [autoBlockadeMaxCollateralISK, setAutoBlockadeMaxCollateralISK] = React.useState<number>(
    COURIER_PRESETS.blockade.maxCollateralISK,
  );
  const [autoDstMaxVolumeM3, setAutoDstMaxVolumeM3] = React.useState<number>(
    COURIER_PRESETS.dst.maxVolumeM3,
  );
  const [autoDstMaxCollateralISK, setAutoDstMaxCollateralISK] = React.useState<number>(
    COURIER_PRESETS.dst.maxCollateralISK,
  );

  const [showAdvancedOptions, setShowAdvancedOptions] = React.useState(false);

  const [liquidityWindowDays, setLiquidityWindowDays] = React.useState<number | undefined>(
    undefined,
  );
  const [liquidityMinCoverageRatio, setLiquidityMinCoverageRatio] = React.useState<
    number | undefined
  >(undefined);
  const [liquidityMinLiquidityThresholdISK, setLiquidityMinLiquidityThresholdISK] =
    React.useState<number | undefined>(undefined);
  const [liquidityMinWindowTrades, setLiquidityMinWindowTrades] = React.useState<
    number | undefined
  >(undefined);

  const [arbMaxInventoryDays, setArbMaxInventoryDays] = React.useState<number | undefined>(
    undefined,
  );
  const [arbMinMarginPercent, setArbMinMarginPercent] = React.useState<number | undefined>(
    undefined,
  );
  const [arbMaxPriceDeviationMultiple, setArbMaxPriceDeviationMultiple] = React.useState<
    number | undefined
  >(undefined);
  const [arbMinTotalProfitISK, setArbMinTotalProfitISK] = React.useState<number | undefined>(
    undefined,
  );
  const [arbDisableInventoryLimit, setArbDisableInventoryLimit] = React.useState<boolean>(false);
  const [arbAllowInventoryTopOff, setArbAllowInventoryTopOff] = React.useState<boolean>(false);

  const [allocationMode, setAllocationMode] = React.useState<AllocationMode>("best");
  const [spreadBias, setSpreadBias] = React.useState<number | undefined>(undefined);

  const [minPackageNetProfitISK, setMinPackageNetProfitISK] = React.useState<
    number | undefined
  >(undefined);
  const [minPackageROIPercent, setMinPackageROIPercent] = React.useState<number | undefined>(
    undefined,
  );
  const [shippingMarginMultiplier, setShippingMarginMultiplier] = React.useState<
    number | undefined
  >(undefined);
  const [densityWeight, setDensityWeight] = React.useState<number | undefined>(undefined);

  const updateJsonSafely = React.useCallback(
    (updater: (current: Record<string, unknown>) => Record<string, unknown>) => {
      try {
        const current = JSON.parse(json) as Record<string, unknown>;
        const updated = updater(current);
        const next = JSON.stringify(updated, null, 2);
        if (next !== json) setJson(next);
      } catch {
        // If JSON is invalid, don't try to sync derived state into it.
      }
    },
    [json],
  );

  React.useEffect(() => {
    if (courierMode === "custom") {
      updateJsonSafely((j) => {
        const next = { ...j };
        delete (next as { courierContracts?: unknown }).courierContracts;
        return next;
      });
      return;
    }

    if (courierMode === "blockade" || courierMode === "dst") {
      const preset = courierMode === "blockade" ? COURIER_PRESETS.blockade : COURIER_PRESETS.dst;

      setCapacityDisplay(formatNumber(preset.maxVolumeM3));
      setCollateralDisplay(formatNumber(preset.maxCollateralISK));

      updateJsonSafely((j) => {
        const next = { ...j };
        next.packageCapacityM3 = preset.maxVolumeM3;
        next.maxPackageCollateralISK = preset.maxCollateralISK;
        delete (next as { courierContracts?: unknown }).courierContracts;
        return next;
      });
      return;
    }

    const maxVolume = Math.max(autoBlockadeMaxVolumeM3, autoDstMaxVolumeM3);
    const maxCollateral = Math.max(autoBlockadeMaxCollateralISK, autoDstMaxCollateralISK);

    setCapacityDisplay(formatNumber(maxVolume));
    setCollateralDisplay(formatNumber(maxCollateral));

    updateJsonSafely((j) => {
      const next = { ...j };
      next.packageCapacityM3 = maxVolume;
      next.maxPackageCollateralISK = maxCollateral;
      (next as { courierContracts?: unknown }).courierContracts = [
        {
          id: "blockade",
          label: "Blockade Runner",
          maxVolumeM3: autoBlockadeMaxVolumeM3,
          maxCollateralISK: autoBlockadeMaxCollateralISK,
        },
        {
          id: "dst",
          label: "DST",
          maxVolumeM3: autoDstMaxVolumeM3,
          maxCollateralISK: autoDstMaxCollateralISK,
        },
      ];
      return next;
    });
  }, [
    courierMode,
    autoBlockadeMaxVolumeM3,
    autoBlockadeMaxCollateralISK,
    autoDstMaxVolumeM3,
    autoDstMaxCollateralISK,
    updateJsonSafely,
  ]);

  const getCurrentParams = React.useCallback(() => {
    try {
      const basePayload = JSON.parse(json);
      return {
        ...basePayload,
        liquidityOptions: {
          windowDays: liquidityWindowDays,
          minCoverageRatio: liquidityMinCoverageRatio,
          minLiquidityThresholdISK: liquidityMinLiquidityThresholdISK,
          minWindowTrades: liquidityMinWindowTrades,
        },
        arbitrageOptions: {
          maxInventoryDays: arbMaxInventoryDays,
          minMarginPercent: arbMinMarginPercent,
          maxPriceDeviationMultiple: arbMaxPriceDeviationMultiple,
          minTotalProfitISK: arbMinTotalProfitISK,
          disableInventoryLimit: arbDisableInventoryLimit,
          allowInventoryTopOff: arbAllowInventoryTopOff,
        },
        allocation: {
          mode: allocationMode,
          spreadBias,
        },
        minPackageNetProfitISK,
        minPackageROIPercent,
        shippingMarginMultiplier,
        densityWeight,
      };
    } catch {
      return {};
    }
  }, [
    json,
    liquidityWindowDays,
    liquidityMinCoverageRatio,
    liquidityMinLiquidityThresholdISK,
    liquidityMinWindowTrades,
    arbMaxInventoryDays,
    arbMinMarginPercent,
    arbMaxPriceDeviationMultiple,
    arbMinTotalProfitISK,
    arbDisableInventoryLimit,
    arbAllowInventoryTopOff,
    allocationMode,
    spreadBias,
    minPackageNetProfitISK,
    minPackageROIPercent,
    shippingMarginMultiplier,
    densityWeight,
  ]);

  const handleLoadProfile = React.useCallback(
    (params: Record<string, unknown>) => {
      setCapacityDisplay(formatNumber((params.packageCapacityM3 as number) || 60000));
      setInvestmentDisplay(formatNumber((params.investmentISK as number) || 10000000000));
      setMaxPackagesDisplay(((params.maxPackagesHint as number) || 20).toString());
      setShareDisplay(
        (((params.perDestinationMaxBudgetSharePerItem as number) || 0.2) * 100).toString(),
      );
      setCollateralDisplay(formatNumber((params.maxPackageCollateralISK as number) || 5000000000));

      const contracts = (params as { courierContracts?: unknown }).courierContracts;
      if (Array.isArray(contracts) && contracts.length > 0) {
        if (contracts.length >= 2) {
          setCourierMode("auto");
          const blockade = contracts.find((c) => (c as { id?: string })?.id === "blockade") as
            | { maxVolumeM3?: number; maxCollateralISK?: number }
            | undefined;
          const dst = contracts.find((c) => (c as { id?: string })?.id === "dst") as
            | { maxVolumeM3?: number; maxCollateralISK?: number }
            | undefined;

          setAutoBlockadeMaxVolumeM3(
            Number(blockade?.maxVolumeM3 ?? COURIER_PRESETS.blockade.maxVolumeM3),
          );
          setAutoBlockadeMaxCollateralISK(
            Number(blockade?.maxCollateralISK ?? COURIER_PRESETS.blockade.maxCollateralISK),
          );
          setAutoDstMaxVolumeM3(Number(dst?.maxVolumeM3 ?? COURIER_PRESETS.dst.maxVolumeM3));
          setAutoDstMaxCollateralISK(
            Number(dst?.maxCollateralISK ?? COURIER_PRESETS.dst.maxCollateralISK),
          );
        } else {
          const only = contracts[0] as { id?: string };
          if (only?.id === "blockade") setCourierMode("blockade");
          else if (only?.id === "dst") setCourierMode("dst");
          else setCourierMode("custom");
        }
      } else {
        const cap = Number(params.packageCapacityM3);
        const col = Number(params.maxPackageCollateralISK);
        if (
          cap === COURIER_PRESETS.blockade.maxVolumeM3 &&
          col === COURIER_PRESETS.blockade.maxCollateralISK
        ) {
          setCourierMode("blockade");
        } else if (
          cap === COURIER_PRESETS.dst.maxVolumeM3 &&
          col === COURIER_PRESETS.dst.maxCollateralISK
        ) {
          setCourierMode("dst");
        } else {
          setCourierMode("custom");
        }
      }

      const liqOpts = (params.liquidityOptions as Record<string, unknown>) || {};
      setLiquidityWindowDays((liqOpts.windowDays as number) || undefined);
      setLiquidityMinCoverageRatio((liqOpts.minCoverageRatio as number) || undefined);
      setLiquidityMinLiquidityThresholdISK((liqOpts.minLiquidityThresholdISK as number) || undefined);
      setLiquidityMinWindowTrades((liqOpts.minWindowTrades as number) || undefined);

      const arbOpts = (params.arbitrageOptions as Record<string, unknown>) || {};
      setArbMaxInventoryDays((arbOpts.maxInventoryDays as number) || undefined);
      setArbMinMarginPercent((arbOpts.minMarginPercent as number) || undefined);
      setArbMaxPriceDeviationMultiple((arbOpts.maxPriceDeviationMultiple as number) || undefined);
      setArbMinTotalProfitISK((arbOpts.minTotalProfitISK as number) || undefined);
      setArbDisableInventoryLimit((arbOpts.disableInventoryLimit as boolean) || false);
      setArbAllowInventoryTopOff((arbOpts.allowInventoryTopOff as boolean) || false);

      const alloc = (params.allocation as Record<string, unknown>) || {};
      setAllocationMode((alloc.mode as AllocationMode) || "best");
      setSpreadBias((alloc.spreadBias as number) || undefined);

      setMinPackageNetProfitISK((params.minPackageNetProfitISK as number) || undefined);
      setMinPackageROIPercent((params.minPackageROIPercent as number) || undefined);
      setShippingMarginMultiplier((params.shippingMarginMultiplier as number) || undefined);
      setDensityWeight((params.densityWeight as number) || undefined);

      try {
        const j = JSON.parse(json);
        const updated = { ...j, ...params };
        setJson(JSON.stringify(updated, null, 2));
      } catch {
        // If JSON is invalid, just skip updating it.
      }
    },
    [json],
  );

  const hasUncommittedPlan = !!data && !commitSuccess;

  React.useEffect(() => {
    if (!hasUncommittedPlan) return;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
    };
  }, [hasUncommittedPlan]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(PLANNER_DRAFT_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as {
        params?: Record<string, unknown>;
        data?: PlanResult | null;
        memo?: string;
        showAdvancedOptions?: boolean;
        restoredAt?: string;
      };

      if (parsed.params) {
        handleLoadProfile(parsed.params);
      }
      if (typeof parsed.showAdvancedOptions === "boolean") {
        setShowAdvancedOptions(parsed.showAdvancedOptions);
      }
      if (parsed.data) {
        setData(parsed.data);
      }
      if (typeof parsed.memo === "string") {
        setMemo(parsed.memo);
      }

      setRestoredFromDraft({
        restoredAt:
          parsed.restoredAt ??
          new Date().toLocaleString(undefined, {
            dateStyle: "short",
            timeStyle: "short",
          }),
      });
    } catch {
      // If anything goes wrong, ignore the draft and start fresh.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const draft = {
        params: getCurrentParams(),
        data,
        memo,
        showAdvancedOptions,
        restoredAt: new Date().toISOString(),
      };
      window.localStorage.setItem(PLANNER_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Ignore storage errors (e.g., quota exceeded).
    }
  }, [getCurrentParams, data, memo, showAdvancedOptions]);

  const handleClearPlan = () => {
    setJson(JSON.stringify(defaultPayload, null, 2));
    setCapacityDisplay(defaultPayload.packageCapacityM3.toLocaleString());
    setInvestmentDisplay(defaultPayload.investmentISK.toLocaleString());
    setMaxPackagesDisplay(defaultPayload.maxPackagesHint.toString());
    setShareDisplay((defaultPayload.perDestinationMaxBudgetSharePerItem * 100).toString());
    setCollateralDisplay(defaultPayload.maxPackageCollateralISK.toLocaleString());

    setCourierMode("blockade");
    setAutoBlockadeMaxVolumeM3(COURIER_PRESETS.blockade.maxVolumeM3);
    setAutoBlockadeMaxCollateralISK(COURIER_PRESETS.blockade.maxCollateralISK);
    setAutoDstMaxVolumeM3(COURIER_PRESETS.dst.maxVolumeM3);
    setAutoDstMaxCollateralISK(COURIER_PRESETS.dst.maxCollateralISK);

    setShowAdvancedOptions(false);
    setLiquidityWindowDays(undefined);
    setLiquidityMinCoverageRatio(undefined);
    setLiquidityMinLiquidityThresholdISK(undefined);
    setLiquidityMinWindowTrades(undefined);
    setArbMaxInventoryDays(undefined);
    setArbMinMarginPercent(undefined);
    setArbMaxPriceDeviationMultiple(undefined);
    setArbMinTotalProfitISK(undefined);
    setArbDisableInventoryLimit(false);
    setArbAllowInventoryTopOff(false);
    setAllocationMode("best");
    setSpreadBias(undefined);
    setMinPackageNetProfitISK(undefined);
    setMinPackageROIPercent(undefined);
    setShippingMarginMultiplier(undefined);
    setDensityWeight(undefined);

    setData(null);
    setMemo("");
    setCommitSuccess(null);
    setRestoredFromDraft(null);

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(PLANNER_DRAFT_STORAGE_KEY);
    }
  };

  const handleCapacityChange = (value: string) => {
    setCapacityDisplay(value);
    try {
      const j = JSON.parse(json) as Record<string, unknown>;
      const numValue = parseFormattedNumber(value);
      if (!Number.isNaN(numValue)) {
        j.packageCapacityM3 = numValue;
        setJson(JSON.stringify(j, null, 2));
      }
    } catch {}
  };

  const handleInvestmentChange = (value: string) => {
    setInvestmentDisplay(value);
    try {
      const j = JSON.parse(json) as Record<string, unknown>;
      const numValue = parseFormattedNumber(value);
      if (!Number.isNaN(numValue)) {
        j.investmentISK = numValue;
        setJson(JSON.stringify(j, null, 2));
      }
    } catch {}
  };

  const handleMaxPackagesChange = (value: string) => {
    setMaxPackagesDisplay(value);
    try {
      const j = JSON.parse(json) as Record<string, unknown>;
      const numValue = Number(value);
      if (!Number.isNaN(numValue)) {
        j.maxPackagesHint = numValue;
        setJson(JSON.stringify(j, null, 2));
      }
    } catch {}
  };

  const handleShareChange = (value: string) => {
    setShareDisplay(value);
    try {
      const j = JSON.parse(json) as Record<string, unknown>;
      const numValue = Number(value) / 100;
      if (!Number.isNaN(numValue)) {
        j.perDestinationMaxBudgetSharePerItem = numValue;
        setJson(JSON.stringify(j, null, 2));
      }
    } catch {}
  };

  const handleCollateralChange = (value: string) => {
    setCollateralDisplay(value);
    try {
      const j = JSON.parse(json) as Record<string, unknown>;
      const numValue = parseFormattedNumber(value);
      if (!Number.isNaN(numValue)) {
        j.maxPackageCollateralISK = numValue;
        setJson(JSON.stringify(j, null, 2));
      }
    } catch {}
  };

  const handleCapacityBlur = () => {
    const numValue = parseFormattedNumber(capacityDisplay);
    if (!Number.isNaN(numValue)) {
      setCapacityDisplay(formatNumber(numValue));
    }
  };

  const handleInvestmentBlur = () => {
    const numValue = parseFormattedNumber(investmentDisplay);
    if (!Number.isNaN(numValue)) {
      setInvestmentDisplay(formatNumber(numValue));
    }
  };

  const handleCollateralBlur = () => {
    const numValue = parseFormattedNumber(collateralDisplay);
    if (!Number.isNaN(numValue)) {
      setCollateralDisplay(formatNumber(numValue));
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setData(null);
    try {
      const payload = JSON.parse(json) as Record<string, unknown>;

      if (showAdvancedOptions) {
        if (
          liquidityWindowDays !== undefined ||
          liquidityMinCoverageRatio !== undefined ||
          liquidityMinLiquidityThresholdISK !== undefined ||
          liquidityMinWindowTrades !== undefined
        ) {
          payload.liquidityOptions = {
            ...(liquidityWindowDays !== undefined && { windowDays: liquidityWindowDays }),
            ...(liquidityMinCoverageRatio !== undefined && {
              minCoverageRatio: liquidityMinCoverageRatio,
            }),
            ...(liquidityMinLiquidityThresholdISK !== undefined && {
              minLiquidityThresholdISK: liquidityMinLiquidityThresholdISK,
            }),
            ...(liquidityMinWindowTrades !== undefined && {
              minWindowTrades: liquidityMinWindowTrades,
            }),
          };
        }

        if (
          arbMaxInventoryDays !== undefined ||
          arbMinMarginPercent !== undefined ||
          arbMaxPriceDeviationMultiple !== undefined ||
          arbMinTotalProfitISK !== undefined ||
          arbDisableInventoryLimit ||
          arbAllowInventoryTopOff
        ) {
          payload.arbitrageOptions = {
            ...(arbMaxInventoryDays !== undefined && { maxInventoryDays: arbMaxInventoryDays }),
            ...(arbMinMarginPercent !== undefined && { minMarginPercent: arbMinMarginPercent }),
            ...(arbMaxPriceDeviationMultiple !== undefined && {
              maxPriceDeviationMultiple: arbMaxPriceDeviationMultiple,
            }),
            ...(arbMinTotalProfitISK !== undefined && {
              minTotalProfitISK: arbMinTotalProfitISK,
            }),
            ...(arbDisableInventoryLimit && { disableInventoryLimit: true }),
            ...(arbAllowInventoryTopOff && { allowInventoryTopOff: true }),
          };
        }

        payload.allocation = {
          mode: allocationMode,
          ...(spreadBias !== undefined && { spreadBias }),
        };

        if (minPackageNetProfitISK !== undefined) {
          payload.minPackageNetProfitISK = minPackageNetProfitISK;
        }
        if (minPackageROIPercent !== undefined) {
          payload.minPackageROIPercent = minPackageROIPercent;
        }
        if (shippingMarginMultiplier !== undefined) {
          payload.shippingMarginMultiplier = shippingMarginMultiplier;
        }
        if (densityWeight !== undefined) {
          payload.densityWeight = densityWeight;
        }
      }

      const result = await planPackagesMutation.mutateAsync(payload);
      setData(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const groupedByDest = React.useMemo(() => groupPackagesByDestination(data), [data]);
  const copyTextByPackage = React.useMemo(() => buildCopyTextByPackage(data), [data]);

  const suggestedShipping = React.useMemo(() => {
    if (!data) return null;
    const n = Number(data.totalShippingISK);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }, [data]);

  const suggestedShippingMemo = React.useMemo(() => {
    if (!data) return "Planner shipping cost";
    const names = Array.from(
      new Set(
        data.packages
          .map((p) => p.destinationName)
          .filter((n): n is string => !!n && n.trim().length > 0),
      ),
    );
    if (!names.length) return "Planner shipping cost";
    const joined = names.slice(0, 4).join(", ");
    const suffix = names.length > 4 ? ` +${names.length - 4} more` : "";
    return `Planner shipping: ${joined}${suffix}`;
  }, [data]);

  const handleCopyList = async (destId: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedDest(destId);
    setTimeout(() => setCopiedDest(null), 2000);
  };

  const commitPlan = async (opts: { recordShipping: boolean }) => {
    if (!data) return;
    setError(null);

    let formattedTransportAmount: string | null = null;
    if (opts.recordShipping) {
      const amountNum = parseFloat(shippingAmount);
      if (Number.isNaN(amountNum) || amountNum <= 0) {
        setError("Please enter a valid positive shipping amount.");
        return;
      }
      formattedTransportAmount = amountNum.toFixed(2);
    }

    try {
      const payload = JSON.parse(json);
      const body = await commitArbitrageMutation.mutateAsync({
        request: payload,
        result: data,
        memo: memo || undefined,
      });

      setCommitSuccess({
        cycleId: body.id,
        packageCount: data.packages.length,
      });
      setCommitDialogOpen(false);

      if (opts.recordShipping && formattedTransportAmount) {
        await addTransportFeeMutation.mutateAsync({
          cycleId: body.id,
          data: {
            amountIsk: formattedTransportAmount,
            memo: shippingMemo || undefined,
          },
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return {
    json,
    setJson,
    error,
    data,
    memo,
    setMemo,
    commitDialogOpen,
    setCommitDialogOpen,
    recordShipping,
    setRecordShipping,
    shippingAmount,
    setShippingAmount,
    shippingMemo,
    setShippingMemo,
    copiedDest,
    commitSuccess,
    restoredFromDraft,
    loading,
    capacityDisplay,
    investmentDisplay,
    maxPackagesDisplay,
    shareDisplay,
    collateralDisplay,
    courierMode,
    setCourierMode,
    autoBlockadeMaxVolumeM3,
    setAutoBlockadeMaxVolumeM3,
    autoBlockadeMaxCollateralISK,
    setAutoBlockadeMaxCollateralISK,
    autoDstMaxVolumeM3,
    setAutoDstMaxVolumeM3,
    autoDstMaxCollateralISK,
    setAutoDstMaxCollateralISK,
    showAdvancedOptions,
    setShowAdvancedOptions,
    liquidityWindowDays,
    setLiquidityWindowDays,
    liquidityMinCoverageRatio,
    setLiquidityMinCoverageRatio,
    liquidityMinLiquidityThresholdISK,
    setLiquidityMinLiquidityThresholdISK,
    liquidityMinWindowTrades,
    setLiquidityMinWindowTrades,
    arbMaxInventoryDays,
    setArbMaxInventoryDays,
    arbMinMarginPercent,
    setArbMinMarginPercent,
    arbMaxPriceDeviationMultiple,
    setArbMaxPriceDeviationMultiple,
    arbMinTotalProfitISK,
    setArbMinTotalProfitISK,
    arbDisableInventoryLimit,
    setArbDisableInventoryLimit,
    arbAllowInventoryTopOff,
    setArbAllowInventoryTopOff,
    allocationMode,
    setAllocationMode,
    spreadBias,
    setSpreadBias,
    minPackageNetProfitISK,
    setMinPackageNetProfitISK,
    minPackageROIPercent,
    setMinPackageROIPercent,
    shippingMarginMultiplier,
    setShippingMarginMultiplier,
    densityWeight,
    setDensityWeight,
    getCurrentParams,
    handleLoadProfile,
    handleClearPlan,
    handleCapacityChange,
    handleInvestmentChange,
    handleMaxPackagesChange,
    handleShareChange,
    handleCollateralChange,
    handleCapacityBlur,
    handleInvestmentBlur,
    handleCollateralBlur,
    handleSubmit,
    groupedByDest: groupedByDest as Record<string, PackagePlan[]>,
    copyTextByPackage,
    suggestedShipping,
    suggestedShippingMemo,
    handleCopyList,
    commitPending: commitArbitrageMutation.isPending,
    addTransportPending: addTransportFeeMutation.isPending,
    commitPlan,
  };
}
