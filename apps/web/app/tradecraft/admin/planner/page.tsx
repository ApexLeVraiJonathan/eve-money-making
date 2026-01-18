"use client";

import * as React from "react";
import Link from "next/link";
import {
  Package,
  Settings,
  TrendingUp,
  Wallet,
  Ship,
  DollarSign,
  Copy,
  Check,
  AlertCircle,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@eve/ui";
import { Input } from "@eve/ui";
import { Textarea } from "@eve/ui";
import { Label } from "@eve/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@eve/ui";
import { Alert, AlertDescription } from "@eve/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@eve/ui";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@eve/ui";
import { ChevronDown } from "lucide-react";
import {
  usePlanArbitrage,
  useCommitArbitrage,
  useAddTransportFee,
} from "../../api";
import { ParameterProfileManager } from "../../components/ParameterProfileManager";
import type { PlanResult, PackagePlan } from "@eve/shared";
import { LabeledInput } from "@eve/ui";
import { Checkbox } from "@eve/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eve/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@eve/ui";

const PLANNER_DRAFT_STORAGE_KEY = "planner-draft-v1";

const COURIER_PRESETS = {
  blockade: {
    id: "blockade",
    label: "Blockade Runner",
    maxVolumeM3: 13_000,
    maxCollateralISK: 4_000_000_000,
  },
  dst: {
    id: "dst",
    label: "DST",
    maxVolumeM3: 60_000,
    maxCollateralISK: 2_000_000_000,
  },
} as const;

const defaultPayload = {
  shippingCostByStation: {
    // DODIXIE (60011866): 15M
    // HEK (60005686): 15M
    // RENS (60004588): 20M
    // AMARR (60008494): 25M
    60008494: 25000000,
    60005686: 15000000,
    60011866: 15000000,
    60004588: 20000000,
  },
  // Defaults tuned for Blockade Runner style hauling (safer, smaller volume, higher collateral tolerance)
  packageCapacityM3: COURIER_PRESETS.blockade.maxVolumeM3,
  investmentISK: 36_000_000_000,
  perDestinationMaxBudgetSharePerItem: 0.15,
  maxPackagesHint: 100,
  maxPackageCollateralISK: COURIER_PRESETS.blockade.maxCollateralISK,
  allocation: { mode: "best" as const },
};

function formatISK(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "ISK",
    currencyDisplay: "code",
    maximumFractionDigits: 2,
  })
    .format(n)
    .replace("ISK", "ISK");
}

export default function PlannerPage() {
  const [json, setJson] = React.useState(
    JSON.stringify(defaultPayload, null, 2),
  );
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<PlanResult | null>(null);
  const [memo, setMemo] = React.useState("");
  const [commitDialogOpen, setCommitDialogOpen] = React.useState(false);
  const [recordShipping, setRecordShipping] = React.useState(true);
  const [shippingAmount, setShippingAmount] = React.useState<string>("");
  const [shippingMemo, setShippingMemo] = React.useState<string>("");
  const [copiedDest, setCopiedDest] = React.useState<string | null>(null);
  const [commitSuccess, setCommitSuccess] = React.useState<{
    cycleId: string;
    packageCount: number;
  } | null>(null);
  const [restoredFromDraft, setRestoredFromDraft] = React.useState<{
    restoredAt: string;
  } | null>(null);

  // React Query mutations
  const planPackagesMutation = usePlanArbitrage();
  const commitArbitrageMutation = useCommitArbitrage();
  const addTransportFeeMutation = useAddTransportFee();

  const loading = planPackagesMutation.isPending;

  // Display values for form inputs (formatted)
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

  // Courier contract mode/state (kept in sync with JSON payload)
  const [courierMode, setCourierMode] = React.useState<
    "blockade" | "dst" | "auto" | "custom"
  >("blockade");
  const [autoBlockadeMaxVolumeM3, setAutoBlockadeMaxVolumeM3] =
    React.useState<number>(COURIER_PRESETS.blockade.maxVolumeM3);
  const [autoBlockadeMaxCollateralISK, setAutoBlockadeMaxCollateralISK] =
    React.useState<number>(COURIER_PRESETS.blockade.maxCollateralISK);
  const [autoDstMaxVolumeM3, setAutoDstMaxVolumeM3] = React.useState<number>(
    COURIER_PRESETS.dst.maxVolumeM3,
  );
  const [autoDstMaxCollateralISK, setAutoDstMaxCollateralISK] =
    React.useState<number>(COURIER_PRESETS.dst.maxCollateralISK);

  // Advanced Options State
  const [showAdvancedOptions, setShowAdvancedOptions] = React.useState(false);

  // Liquidity Options
  const [liquidityWindowDays, setLiquidityWindowDays] = React.useState<
    number | undefined
  >(undefined);
  const [liquidityMinCoverageRatio, setLiquidityMinCoverageRatio] =
    React.useState<number | undefined>(undefined);
  const [
    liquidityMinLiquidityThresholdISK,
    setLiquidityMinLiquidityThresholdISK,
  ] = React.useState<number | undefined>(undefined);
  const [liquidityMinWindowTrades, setLiquidityMinWindowTrades] =
    React.useState<number | undefined>(undefined);

  // Arbitrage Options
  const [arb_maxInventoryDays, setArb_maxInventoryDays] = React.useState<
    number | undefined
  >(undefined);
  const [arb_minMarginPercent, setArb_minMarginPercent] = React.useState<
    number | undefined
  >(undefined);
  const [arb_maxPriceDeviationMultiple, setArb_maxPriceDeviationMultiple] =
    React.useState<number | undefined>(undefined);
  const [arb_minTotalProfitISK, setArb_minTotalProfitISK] = React.useState<
    number | undefined
  >(undefined);
  const [arb_disableInventoryLimit, setArb_disableInventoryLimit] =
    React.useState<boolean>(false);
  const [arb_allowInventoryTopOff, setArb_allowInventoryTopOff] =
    React.useState<boolean>(false);

  // Allocation Options
  const [allocationMode, setAllocationMode] = React.useState<
    "best" | "targetWeighted" | "roundRobin"
  >("best");
  const [spreadBias, setSpreadBias] = React.useState<number | undefined>(
    undefined,
  );

  // Package Quality Thresholds
  const [minPackageNetProfitISK, setMinPackageNetProfitISK] = React.useState<
    number | undefined
  >(undefined);
  const [minPackageROIPercent, setMinPackageROIPercent] = React.useState<
    number | undefined
  >(undefined);
  const [shippingMarginMultiplier, setShippingMarginMultiplier] =
    React.useState<number | undefined>(undefined);
  const [densityWeight, setDensityWeight] = React.useState<number | undefined>(
    undefined,
  );

  // Helper to parse formatted number string to number
  const parseFormattedNumber = (value: string): number => {
    return Number(value.replace(/,/g, ""));
  };

  // Helper to format number with commas
  const formatNumber = React.useCallback((value: number): string => {
    return value.toLocaleString();
  }, []);

  const updateJsonSafely = React.useCallback(
    (
      updater: (current: Record<string, unknown>) => Record<string, unknown>,
    ) => {
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

  // Keep courier mode/presets in sync with the JSON payload + the visible capacity/collateral fields.
  React.useEffect(() => {
    if (courierMode === "custom") {
      updateJsonSafely((j) => {
        // Custom mode uses the legacy fields directly.
        const next = { ...j };
        delete (next as { courierContracts?: unknown }).courierContracts;
        return next;
      });
      return;
    }

    if (courierMode === "blockade" || courierMode === "dst") {
      const preset =
        courierMode === "blockade"
          ? COURIER_PRESETS.blockade
          : COURIER_PRESETS.dst;

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

    // Auto (mix): we let the packager choose the best preset per package.
    const maxVolume = Math.max(autoBlockadeMaxVolumeM3, autoDstMaxVolumeM3);
    const maxCollateral = Math.max(
      autoBlockadeMaxCollateralISK,
      autoDstMaxCollateralISK,
    );

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
    formatNumber,
    updateJsonSafely,
  ]);

  // Helper to get current parameters as an object
  const getCurrentParams = React.useCallback(() => {
    try {
      const basePayload = JSON.parse(json);
      return {
        ...basePayload,
        // Include advanced options state
        liquidityOptions: {
          windowDays: liquidityWindowDays,
          minCoverageRatio: liquidityMinCoverageRatio,
          minLiquidityThresholdISK: liquidityMinLiquidityThresholdISK,
          minWindowTrades: liquidityMinWindowTrades,
        },
        arbitrageOptions: {
          maxInventoryDays: arb_maxInventoryDays,
          minMarginPercent: arb_minMarginPercent,
          maxPriceDeviationMultiple: arb_maxPriceDeviationMultiple,
          minTotalProfitISK: arb_minTotalProfitISK,
          disableInventoryLimit: arb_disableInventoryLimit,
          allowInventoryTopOff: arb_allowInventoryTopOff,
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
    arb_maxInventoryDays,
    arb_minMarginPercent,
    arb_maxPriceDeviationMultiple,
    arb_minTotalProfitISK,
    arb_disableInventoryLimit,
    arb_allowInventoryTopOff,
    allocationMode,
    spreadBias,
    minPackageNetProfitISK,
    minPackageROIPercent,
    shippingMarginMultiplier,
    densityWeight,
  ]);

  // Helper to load parameters from a profile
  const handleLoadProfile = React.useCallback(
    (params: Record<string, unknown>) => {
      // Load base parameters - always set them
      setCapacityDisplay(
        formatNumber((params.packageCapacityM3 as number) || 60000),
      );
      setInvestmentDisplay(
        formatNumber((params.investmentISK as number) || 10000000000),
      );
      setMaxPackagesDisplay(
        ((params.maxPackagesHint as number) || 20).toString(),
      );
      setShareDisplay(
        (
          ((params.perDestinationMaxBudgetSharePerItem as number) || 0.2) * 100
        ).toString(),
      );
      setCollateralDisplay(
        formatNumber((params.maxPackageCollateralISK as number) || 5000000000),
      );

      // Load courier mode/presets (optional)
      const contracts = (params as { courierContracts?: unknown })
        .courierContracts;
      if (Array.isArray(contracts) && contracts.length > 0) {
        if (contracts.length >= 2) {
          setCourierMode("auto");
          const blockade = contracts.find(
            (c) => (c as { id?: string })?.id === "blockade",
          ) as { maxVolumeM3?: number; maxCollateralISK?: number } | undefined;
          const dst = contracts.find(
            (c) => (c as { id?: string })?.id === "dst",
          ) as { maxVolumeM3?: number; maxCollateralISK?: number } | undefined;

          setAutoBlockadeMaxVolumeM3(
            Number(
              blockade?.maxVolumeM3 ?? COURIER_PRESETS.blockade.maxVolumeM3,
            ),
          );
          setAutoBlockadeMaxCollateralISK(
            Number(
              blockade?.maxCollateralISK ??
                COURIER_PRESETS.blockade.maxCollateralISK,
            ),
          );
          setAutoDstMaxVolumeM3(
            Number(dst?.maxVolumeM3 ?? COURIER_PRESETS.dst.maxVolumeM3),
          );
          setAutoDstMaxCollateralISK(
            Number(
              dst?.maxCollateralISK ?? COURIER_PRESETS.dst.maxCollateralISK,
            ),
          );
        } else {
          const only = contracts[0] as { id?: string };
          if (only?.id === "blockade") setCourierMode("blockade");
          else if (only?.id === "dst") setCourierMode("dst");
          else setCourierMode("custom");
        }
      } else {
        // Infer from legacy fields if possible
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

      // Load liquidity options - clear if not in profile
      const liqOpts =
        (params.liquidityOptions as Record<string, unknown>) || {};
      setLiquidityWindowDays((liqOpts.windowDays as number) || undefined);
      setLiquidityMinCoverageRatio(
        (liqOpts.minCoverageRatio as number) || undefined,
      );
      setLiquidityMinLiquidityThresholdISK(
        (liqOpts.minLiquidityThresholdISK as number) || undefined,
      );
      setLiquidityMinWindowTrades(
        (liqOpts.minWindowTrades as number) || undefined,
      );

      // Load arbitrage options - clear if not in profile
      const arbOpts =
        (params.arbitrageOptions as Record<string, unknown>) || {};
      setArb_maxInventoryDays(
        (arbOpts.maxInventoryDays as number) || undefined,
      );
      setArb_minMarginPercent(
        (arbOpts.minMarginPercent as number) || undefined,
      );
      setArb_maxPriceDeviationMultiple(
        (arbOpts.maxPriceDeviationMultiple as number) || undefined,
      );
      setArb_minTotalProfitISK(
        (arbOpts.minTotalProfitISK as number) || undefined,
      );
      setArb_disableInventoryLimit(
        (arbOpts.disableInventoryLimit as boolean) || false,
      );
      setArb_allowInventoryTopOff(
        (arbOpts.allowInventoryTopOff as boolean) || false,
      );

      // Load allocation options
      const alloc = (params.allocation as Record<string, unknown>) || {};
      setAllocationMode(
        (alloc.mode as "best" | "targetWeighted" | "roundRobin") || "best",
      );
      setSpreadBias((alloc.spreadBias as number) || undefined);

      // Load package quality thresholds - clear if not in profile
      setMinPackageNetProfitISK(
        (params.minPackageNetProfitISK as number) || undefined,
      );
      setMinPackageROIPercent(
        (params.minPackageROIPercent as number) || undefined,
      );
      setShippingMarginMultiplier(
        (params.shippingMarginMultiplier as number) || undefined,
      );
      setDensityWeight((params.densityWeight as number) || undefined);

      // Update JSON to match
      try {
        const j = JSON.parse(json);
        const updated = { ...j, ...params };
        setJson(JSON.stringify(updated, null, 2));
      } catch {
        // If JSON is invalid, just skip updating it
      }
    },
    [formatNumber, json],
  );

  const hasUncommittedPlan = !!data && !commitSuccess;

  // Warn on page unload if there is an uncommitted plan
  React.useEffect(() => {
    if (!hasUncommittedPlan) {
      return;
    }

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Required for some browsers to show the prompt
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
    };
  }, [hasUncommittedPlan]);

  // Restore draft from localStorage on mount (if any)
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
      // If anything goes wrong, just ignore draft and start fresh
    }
    // We intentionally do NOT include handleLoadProfile in deps because this
    // effect should only run once on mount, and handleLoadProfile is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist current planner draft to localStorage
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
      window.localStorage.setItem(
        PLANNER_DRAFT_STORAGE_KEY,
        JSON.stringify(draft),
      );
    } catch {
      // Ignore storage errors (e.g., quota exceeded)
    }
  }, [getCurrentParams, data, memo, showAdvancedOptions]);

  const handleClearPlan = () => {
    // Reset core payload & display fields
    setJson(JSON.stringify(defaultPayload, null, 2));
    setCapacityDisplay(defaultPayload.packageCapacityM3.toLocaleString());
    setInvestmentDisplay(defaultPayload.investmentISK.toLocaleString());
    setMaxPackagesDisplay(defaultPayload.maxPackagesHint.toString());
    setShareDisplay(
      (defaultPayload.perDestinationMaxBudgetSharePerItem * 100).toString(),
    );
    setCollateralDisplay(
      defaultPayload.maxPackageCollateralISK.toLocaleString(),
    );

    // Reset courier mode/presets
    setCourierMode("blockade");
    setAutoBlockadeMaxVolumeM3(COURIER_PRESETS.blockade.maxVolumeM3);
    setAutoBlockadeMaxCollateralISK(COURIER_PRESETS.blockade.maxCollateralISK);
    setAutoDstMaxVolumeM3(COURIER_PRESETS.dst.maxVolumeM3);
    setAutoDstMaxCollateralISK(COURIER_PRESETS.dst.maxCollateralISK);

    // Reset advanced options
    setShowAdvancedOptions(false);
    setLiquidityWindowDays(undefined);
    setLiquidityMinCoverageRatio(undefined);
    setLiquidityMinLiquidityThresholdISK(undefined);
    setLiquidityMinWindowTrades(undefined);
    setArb_maxInventoryDays(undefined);
    setArb_minMarginPercent(undefined);
    setArb_maxPriceDeviationMultiple(undefined);
    setArb_minTotalProfitISK(undefined);
    setArb_disableInventoryLimit(false);
    setArb_allowInventoryTopOff(false);
    setAllocationMode("best");
    setSpreadBias(undefined);
    setMinPackageNetProfitISK(undefined);
    setMinPackageROIPercent(undefined);
    setShippingMarginMultiplier(undefined);
    setDensityWeight(undefined);

    // Clear plan results & memo
    setData(null);
    setMemo("");
    setCommitSuccess(null);
    setRestoredFromDraft(null);

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(PLANNER_DRAFT_STORAGE_KEY);
    }
  };

  // Update handlers for each field
  const handleCapacityChange = (value: string) => {
    setCapacityDisplay(value);
    try {
      const j = JSON.parse(json);
      const numValue = parseFormattedNumber(value);
      if (!isNaN(numValue)) {
        j.packageCapacityM3 = numValue;
        setJson(JSON.stringify(j, null, 2));
      }
    } catch {}
  };

  const handleInvestmentChange = (value: string) => {
    setInvestmentDisplay(value);
    try {
      const j = JSON.parse(json);
      const numValue = parseFormattedNumber(value);
      if (!isNaN(numValue)) {
        j.investmentISK = numValue;
        setJson(JSON.stringify(j, null, 2));
      }
    } catch {}
  };

  const handleMaxPackagesChange = (value: string) => {
    setMaxPackagesDisplay(value);
    try {
      const j = JSON.parse(json);
      const numValue = Number(value);
      if (!isNaN(numValue)) {
        j.maxPackagesHint = numValue;
        setJson(JSON.stringify(j, null, 2));
      }
    } catch {}
  };

  const handleShareChange = (value: string) => {
    setShareDisplay(value);
    try {
      const j = JSON.parse(json);
      const numValue = Number(value) / 100; // Convert percentage to decimal
      if (!isNaN(numValue)) {
        j.perDestinationMaxBudgetSharePerItem = numValue;
        setJson(JSON.stringify(j, null, 2));
      }
    } catch {}
  };

  const handleCollateralChange = (value: string) => {
    setCollateralDisplay(value);
    try {
      const j = JSON.parse(json);
      const numValue = parseFormattedNumber(value);
      if (!isNaN(numValue)) {
        j.maxPackageCollateralISK = numValue;
        setJson(JSON.stringify(j, null, 2));
      }
    } catch {}
  };

  // Format on blur to add commas
  const handleCapacityBlur = () => {
    const numValue = parseFormattedNumber(capacityDisplay);
    if (!isNaN(numValue)) {
      setCapacityDisplay(formatNumber(numValue));
    }
  };

  const handleInvestmentBlur = () => {
    const numValue = parseFormattedNumber(investmentDisplay);
    if (!isNaN(numValue)) {
      setInvestmentDisplay(formatNumber(numValue));
    }
  };

  const handleCollateralBlur = () => {
    const numValue = parseFormattedNumber(collateralDisplay);
    if (!isNaN(numValue)) {
      setCollateralDisplay(formatNumber(numValue));
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setData(null);
    try {
      const payload = JSON.parse(json);

      // Add advanced options if enabled
      if (showAdvancedOptions) {
        // Liquidity Options
        if (
          liquidityWindowDays !== undefined ||
          liquidityMinCoverageRatio !== undefined ||
          liquidityMinLiquidityThresholdISK !== undefined ||
          liquidityMinWindowTrades !== undefined
        ) {
          payload.liquidityOptions = {
            ...(liquidityWindowDays !== undefined && {
              windowDays: liquidityWindowDays,
            }),
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

        // Arbitrage Options
        if (
          arb_maxInventoryDays !== undefined ||
          arb_minMarginPercent !== undefined ||
          arb_maxPriceDeviationMultiple !== undefined ||
          arb_minTotalProfitISK !== undefined ||
          arb_disableInventoryLimit ||
          arb_allowInventoryTopOff
        ) {
          payload.arbitrageOptions = {
            ...(arb_maxInventoryDays !== undefined && {
              maxInventoryDays: arb_maxInventoryDays,
            }),
            ...(arb_minMarginPercent !== undefined && {
              minMarginPercent: arb_minMarginPercent,
            }),
            ...(arb_maxPriceDeviationMultiple !== undefined && {
              maxPriceDeviationMultiple: arb_maxPriceDeviationMultiple,
            }),
            ...(arb_minTotalProfitISK !== undefined && {
              minTotalProfitISK: arb_minTotalProfitISK,
            }),
            ...(arb_disableInventoryLimit && { disableInventoryLimit: true }),
            ...(arb_allowInventoryTopOff && { allowInventoryTopOff: true }),
          };
        }

        // Allocation Options
        // Always include allocation since we have the mode selector
        payload.allocation = {
          mode: allocationMode,
          ...(spreadBias !== undefined && { spreadBias }),
        };

        // Package Quality Thresholds
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

  // Group packages by destination
  const groupedByDest = React.useMemo(() => {
    if (!data) return {} as Record<string, PackagePlan[]>;
    return data.packages.reduce<Record<string, PackagePlan[]>>((acc, pkg) => {
      const key = String(pkg.destinationStationId);
      if (!acc[key]) acc[key] = [];
      acc[key].push(pkg);
      return acc;
    }, {});
  }, [data]);

  // Build copy lists per package
  const copyTextByPackage = React.useMemo(() => {
    const map: Record<string, string> = {};
    if (!data) return map;
    for (const pkg of data.packages) {
      const key = `${pkg.destinationStationId}-${pkg.packageIndex}`;
      map[key] = pkg.items
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((it) => `${it.name}\t${it.units}`)
        .join("\n");
    }
    return map;
  }, [data]);

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
      if (isNaN(amountNum) || amountNum <= 0) {
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

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-2">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Settings className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Package Planner
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure and generate optimized arbitrage packages
          </p>
        </div>
      </div>

      {restoredFromDraft && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Restored your last uncommitted plan
              {restoredFromDraft.restoredAt
                ? ` (saved at ${restoredFromDraft.restoredAt})`
                : ""}
              .
            </span>
            <Button variant="outline" size="sm" onClick={handleClearPlan}>
              Clear plan
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Configuration Section */}
      <Tabs defaultValue="simple" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="simple">Simple</TabsTrigger>
          <TabsTrigger value="advanced">Advanced (JSON)</TabsTrigger>
        </TabsList>

        <TabsContent value="simple" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Planning Parameters
                  </CardTitle>
                  <CardDescription>
                    Configure the constraints and limits for package generation
                  </CardDescription>
                </div>
                <ParameterProfileManager
                  scope="PLANNER"
                  currentParams={getCurrentParams()}
                  onLoadProfile={handleLoadProfile}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label>Courier Contract</Label>
                  <Select
                    value={courierMode}
                    onValueChange={(value) =>
                      setCourierMode(
                        value as "blockade" | "dst" | "auto" | "custom",
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blockade">
                        Blockade Runner (13,000 m³ / 4B collateral)
                      </SelectItem>
                      <SelectItem value="dst">
                        DST (60,000 m³ / 2B collateral)
                      </SelectItem>
                      <SelectItem value="auto">
                        Auto (mix Blockade + DST per package)
                      </SelectItem>
                      <SelectItem value="custom">Custom (manual)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Auto mode lets the planner choose the best courier preset
                    per package based on volume and collateral constraints.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="capacity">Package Capacity (m³)</Label>
                  <Input
                    id="capacity"
                    type="text"
                    value={capacityDisplay}
                    onChange={(e) => handleCapacityChange(e.target.value)}
                    onBlur={handleCapacityBlur}
                    disabled={courierMode !== "custom"}
                  />
                  <p className="text-xs text-muted-foreground">
                    {courierMode === "auto"
                      ? "Auto mode uses per-package presets; this field shows the max envelope."
                      : courierMode === "custom"
                        ? "Maximum volume per package"
                        : "Derived from selected courier preset"}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="investment">Total Investment (ISK)</Label>
                  <Input
                    id="investment"
                    type="text"
                    value={investmentDisplay}
                    onChange={(e) => handleInvestmentChange(e.target.value)}
                    onBlur={handleInvestmentBlur}
                  />
                  <p className="text-xs text-muted-foreground">
                    Total budget available
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxPackages">Max Packages</Label>
                  <Input
                    id="maxPackages"
                    type="text"
                    value={maxPackagesDisplay}
                    onChange={(e) => handleMaxPackagesChange(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum number of packages
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="share">Per-Item Budget Share (%)</Label>
                  <Input
                    id="share"
                    type="text"
                    value={shareDisplay}
                    onChange={(e) => handleShareChange(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Max budget % per item per destination
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxCollateral">
                    Max Package Collateral (ISK)
                  </Label>
                  <Input
                    id="maxCollateral"
                    type="text"
                    value={collateralDisplay}
                    onChange={(e) => handleCollateralChange(e.target.value)}
                    onBlur={handleCollateralBlur}
                    disabled={courierMode !== "custom"}
                  />
                  <p className="text-xs text-muted-foreground">
                    {courierMode === "auto"
                      ? "Auto mode uses per-package presets; this field shows the max envelope."
                      : courierMode === "custom"
                        ? "Max total value per package"
                        : "Derived from selected courier preset"}
                  </p>
                </div>
              </div>

              {courierMode === "auto" && (
                <div className="mt-6 space-y-3">
                  <div className="text-sm font-semibold">
                    Auto Courier Presets
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-3 rounded-lg border p-4">
                      <div className="text-sm font-medium">Blockade Runner</div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Max Volume (m³)</Label>
                          <Input
                            type="number"
                            value={autoBlockadeMaxVolumeM3}
                            onChange={(e) =>
                              setAutoBlockadeMaxVolumeM3(
                                Number(e.target.value || 0),
                              )
                            }
                            min="0"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Max Collateral (ISK)</Label>
                          <Input
                            type="number"
                            value={autoBlockadeMaxCollateralISK}
                            onChange={(e) =>
                              setAutoBlockadeMaxCollateralISK(
                                Number(e.target.value || 0),
                              )
                            }
                            min="0"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 rounded-lg border p-4">
                      <div className="text-sm font-medium">DST</div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Max Volume (m³)</Label>
                          <Input
                            type="number"
                            value={autoDstMaxVolumeM3}
                            onChange={(e) =>
                              setAutoDstMaxVolumeM3(Number(e.target.value || 0))
                            }
                            min="0"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Max Collateral (ISK)</Label>
                          <Input
                            type="number"
                            value={autoDstMaxCollateralISK}
                            onChange={(e) =>
                              setAutoDstMaxCollateralISK(
                                Number(e.target.value || 0),
                              )
                            }
                            min="0"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Advanced Options Collapsible */}
          <Collapsible
            open={showAdvancedOptions}
            onOpenChange={setShowAdvancedOptions}
          >
            <Card>
              <CollapsibleTrigger className="w-full">
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="text-left">
                      <CardTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        Advanced Pipeline Options
                      </CardTitle>
                      <CardDescription>
                        Fine-tune liquidity and arbitrage parameters
                      </CardDescription>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 transition-transform ${showAdvancedOptions ? "rotate-180" : ""}`}
                    />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-6 pt-0">
                  {/* Liquidity Options */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Liquidity Filters
                    </h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      <LabeledInput
                        label="Time Window (days)"
                        tooltip="Override the liquidity window for deeper analysis. Leave empty to use default."
                      >
                        <Input
                          type="number"
                          value={liquidityWindowDays ?? ""}
                          onChange={(e) =>
                            setLiquidityWindowDays(
                              e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            )
                          }
                          min="1"
                          placeholder="Default"
                        />
                      </LabeledInput>

                      <LabeledInput
                        label="Min Coverage Ratio"
                        tooltip="Minimum fraction of days with trades (0-1). Higher values ensure more consistent trading."
                      >
                        <Input
                          type="number"
                          value={liquidityMinCoverageRatio ?? ""}
                          onChange={(e) =>
                            setLiquidityMinCoverageRatio(
                              e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            )
                          }
                          min="0"
                          max="1"
                          step="0.1"
                          placeholder="Default"
                        />
                      </LabeledInput>

                      <LabeledInput
                        label="Min Daily ISK Volume"
                        tooltip="Minimum average daily ISK value traded. Filters out low-volume items."
                      >
                        <Input
                          type="number"
                          value={liquidityMinLiquidityThresholdISK ?? ""}
                          onChange={(e) =>
                            setLiquidityMinLiquidityThresholdISK(
                              e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            )
                          }
                          min="0"
                          placeholder="Default"
                        />
                      </LabeledInput>

                      <LabeledInput
                        label="Min Daily Trades"
                        tooltip="Minimum average number of trades per day. Ensures active market participation."
                      >
                        <Input
                          type="number"
                          value={liquidityMinWindowTrades ?? ""}
                          onChange={(e) =>
                            setLiquidityMinWindowTrades(
                              e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            )
                          }
                          min="0"
                          placeholder="Default"
                        />
                      </LabeledInput>
                    </div>
                  </div>

                  {/* Arbitrage Options */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Arbitrage Constraints
                    </h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      <LabeledInput
                        label="Max Inventory Days"
                        tooltip="Maximum days of average daily volume to hold as inventory. Controls position sizing."
                      >
                        <Input
                          type="number"
                          value={arb_maxInventoryDays ?? ""}
                          onChange={(e) =>
                            setArb_maxInventoryDays(
                              e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            )
                          }
                          min="0.1"
                          step="0.1"
                          placeholder="Default (3)"
                        />
                      </LabeledInput>

                      <LabeledInput
                        label="Min Margin %"
                        tooltip="Minimum profit margin percentage after fees. Higher values = fewer but more profitable opportunities."
                      >
                        <Input
                          type="number"
                          value={arb_minMarginPercent ?? ""}
                          onChange={(e) =>
                            setArb_minMarginPercent(
                              e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            )
                          }
                          min="0"
                          step="1"
                          placeholder="Default (10)"
                        />
                      </LabeledInput>

                      <LabeledInput
                        label="Max Price Deviation Multiple"
                        tooltip="Reject opportunities where current price > historical average by this multiple. Helps avoid overpriced items."
                      >
                        <Input
                          type="number"
                          value={arb_maxPriceDeviationMultiple ?? ""}
                          onChange={(e) =>
                            setArb_maxPriceDeviationMultiple(
                              e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            )
                          }
                          min="1"
                          step="0.1"
                          placeholder="No limit"
                        />
                      </LabeledInput>

                      <LabeledInput
                        label="Min Total Profit (ISK)"
                        tooltip="Minimum total profit per opportunity. Filters out small opportunities."
                      >
                        <Input
                          type="number"
                          value={arb_minTotalProfitISK ?? ""}
                          onChange={(e) =>
                            setArb_minTotalProfitISK(
                              e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            )
                          }
                          min="0"
                          placeholder="Default"
                        />
                      </LabeledInput>
                    </div>

                    {/* Inventory Control */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="planner-disableInventory"
                          checked={arb_disableInventoryLimit}
                          onCheckedChange={(checked) =>
                            setArb_disableInventoryLimit(checked as boolean)
                          }
                        />
                        <div className="space-y-1">
                          <label
                            htmlFor="planner-disableInventory"
                            className="text-sm font-medium leading-none cursor-pointer"
                          >
                            Disable Inventory Limits
                          </label>
                          <p className="text-xs text-muted-foreground">
                            Ignore current cycle inventory constraints
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="planner-allowTopOff"
                          checked={arb_allowInventoryTopOff}
                          onCheckedChange={(checked) =>
                            setArb_allowInventoryTopOff(checked as boolean)
                          }
                          disabled={arb_disableInventoryLimit}
                        />
                        <div className="space-y-1">
                          <label
                            htmlFor="planner-allowTopOff"
                            className="text-sm font-medium leading-none cursor-pointer"
                          >
                            Allow Inventory Top-Off
                          </label>
                          <p className="text-xs text-muted-foreground">
                            Add to existing positions up to max inventory days
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Packaging/Allocation Options */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Packaging & Allocation
                    </h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      <LabeledInput
                        label="Allocation Mode"
                        tooltip="Strategy for distributing opportunities across packages: 'best' prioritizes highest efficiency, 'roundRobin' distributes evenly, 'targetWeighted' uses custom targets."
                      >
                        <Select
                          value={allocationMode}
                          onValueChange={(value) =>
                            setAllocationMode(
                              value as "best" | "targetWeighted" | "roundRobin",
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="best">
                              Best (Efficiency First)
                            </SelectItem>
                            <SelectItem value="roundRobin">
                              Round Robin (Even Distribution)
                            </SelectItem>
                            <SelectItem value="targetWeighted">
                              Target Weighted (Custom)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </LabeledInput>

                      <LabeledInput
                        label="Spread Bias"
                        tooltip="For targetWeighted mode: controls how strongly to bias selection toward under-target destinations. Higher values = stronger correction toward targets."
                      >
                        <Input
                          type="number"
                          value={spreadBias ?? ""}
                          onChange={(e) =>
                            setSpreadBias(
                              e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            )
                          }
                          min="0"
                          step="0.1"
                          placeholder="Default"
                          disabled={allocationMode !== "targetWeighted"}
                        />
                      </LabeledInput>
                    </div>
                  </div>

                  {/* Package Quality Thresholds */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Package Quality Filters
                    </h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      <LabeledInput
                        label="Min Package Net Profit (ISK)"
                        tooltip="Reject packages with net profit below this threshold. Prevents wasting effort on low-value contracts."
                      >
                        <Input
                          type="number"
                          value={minPackageNetProfitISK ?? ""}
                          onChange={(e) =>
                            setMinPackageNetProfitISK(
                              e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            )
                          }
                          min="0"
                          placeholder="No minimum"
                        />
                      </LabeledInput>

                      <LabeledInput
                        label="Min Package ROI %"
                        tooltip="Reject packages with ROI (netProfit/spend * 100) below this threshold. Ensures minimum efficiency for each contract."
                      >
                        <Input
                          type="number"
                          value={minPackageROIPercent ?? ""}
                          onChange={(e) =>
                            setMinPackageROIPercent(
                              e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            )
                          }
                          min="0"
                          step="0.1"
                          placeholder="No minimum"
                        />
                      </LabeledInput>

                      <LabeledInput
                        label="Shipping Margin Multiplier"
                        tooltip="Require box gross profit >= shipping cost × this multiplier. Default 1.0 = break-even; 1.5 = require 50% more profit than shipping. Prevents barely-profitable packages."
                      >
                        <Input
                          type="number"
                          value={shippingMarginMultiplier ?? ""}
                          onChange={(e) =>
                            setShippingMarginMultiplier(
                              e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            )
                          }
                          min="1"
                          step="0.1"
                          placeholder="Default (1.0)"
                        />
                      </LabeledInput>

                      <LabeledInput
                        label="Density Weight"
                        tooltip="Item prioritization blend: 1.0 = pure density (profit/m³, space-limited), 0.0 = pure ROI (profit/cost, capital-limited), 0.5 = equal blend. Adjust based on whether you're constrained by cargo space or budget."
                      >
                        <Input
                          type="number"
                          value={densityWeight ?? ""}
                          onChange={(e) =>
                            setDensityWeight(
                              e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            )
                          }
                          min="0"
                          max="1"
                          step="0.1"
                          placeholder="Default (1.0)"
                        />
                      </LabeledInput>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Configuration</CardTitle>
              <CardDescription>
                Direct JSON editing for fine-grained control
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Label htmlFor="payload">Request JSON</Label>
              <Textarea
                id="payload"
                value={json}
                onChange={(e) => setJson(e.target.value)}
                className="font-mono text-xs min-h-96 mt-2"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Button
          onClick={handleSubmit}
          disabled={loading}
          className="gap-2 flex-1 sm:flex-initial"
          size="lg"
        >
          {loading ? (
            "Planning..."
          ) : (
            <>
              <Package className="h-4 w-4" />
              Generate Plan
            </>
          )}
        </Button>

        {data && (
          <div className="flex-1 flex gap-2">
            <Input
              placeholder="Commit memo (optional)"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
            <Button
              variant="secondary"
              disabled={!data || commitArbitrageMutation.isPending}
              onClick={async () => {
                if (!data) return;
                // Default behavior: propose recording the plan's shipping cost as a transport fee on commit.
                const suggested = suggestedShipping ?? 0;
                setRecordShipping(true);
                setShippingAmount(suggested > 0 ? suggested.toFixed(2) : "");
                setShippingMemo(suggestedShippingMemo);
                setCommitDialogOpen(true);
              }}
              className="gap-2"
            >
              {commitArbitrageMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Committing...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Commit Plan
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      <Dialog open={commitDialogOpen} onOpenChange={setCommitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Commit plan</DialogTitle>
            <DialogDescription>
              Optionally record shipping/transport cost on the new cycle so it
              is included in profit automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="recordShipping"
                checked={recordShipping}
                onCheckedChange={(v) => setRecordShipping(Boolean(v))}
                disabled={
                  commitArbitrageMutation.isPending ||
                  addTransportFeeMutation.isPending
                }
              />
              <div className="space-y-1">
                <Label
                  htmlFor="recordShipping"
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  Record shipping cost as a transport fee
                </Label>
                <p className="text-xs text-muted-foreground">
                  Suggested from this plan:{" "}
                  <span className="font-medium">
                    {suggestedShipping !== null
                      ? formatISK(suggestedShipping)
                      : "—"}
                  </span>
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="shippingAmount">Amount (ISK)</Label>
                <Input
                  id="shippingAmount"
                  type="number"
                  placeholder="0.00"
                  value={shippingAmount}
                  onChange={(e) => setShippingAmount(e.target.value)}
                  disabled={
                    !recordShipping ||
                    commitArbitrageMutation.isPending ||
                    addTransportFeeMutation.isPending
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shippingMemo">Memo (optional)</Label>
                <Input
                  id="shippingMemo"
                  type="text"
                  placeholder="e.g., Jita → Amarr"
                  value={shippingMemo}
                  onChange={(e) => setShippingMemo(e.target.value)}
                  disabled={
                    !recordShipping ||
                    commitArbitrageMutation.isPending ||
                    addTransportFeeMutation.isPending
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCommitDialogOpen(false)}
              disabled={
                commitArbitrageMutation.isPending ||
                addTransportFeeMutation.isPending
              }
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void commitPlan({ recordShipping: false })}
              disabled={
                !data ||
                commitArbitrageMutation.isPending ||
                addTransportFeeMutation.isPending
              }
            >
              Commit only
            </Button>
            <Button
              type="button"
              onClick={() => void commitPlan({ recordShipping })}
              disabled={
                !data ||
                commitArbitrageMutation.isPending ||
                addTransportFeeMutation.isPending
              }
              className="gap-2"
            >
              {addTransportFeeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Recording...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  {recordShipping ? "Commit + record shipping" : "Commit plan"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {commitSuccess && (
        <Alert className="border-emerald-500/20 bg-emerald-500/10">
          <CheckCircle className="h-4 w-4 text-emerald-500" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Plan committed successfully! {commitSuccess.packageCount} packages
              created for cycle {commitSuccess.cycleId.slice(0, 8)}...
            </span>
            <Link
              href={`/tradecraft/admin/packages?cycleId=${commitSuccess.cycleId}`}
            >
              <Button variant="outline" size="sm" className="ml-4">
                View Packages →
              </Button>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Results Section */}
      {data && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="text-sm font-medium flex items-center gap-1.5">
                  <Wallet className="h-4 w-4" />
                  Total Spend
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tabular-nums">
                  {formatISK(data.totalSpendISK)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.packages.length} packages
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="text-sm font-medium flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4" />
                  Gross Profit
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tabular-nums text-emerald-600">
                  {formatISK(data.totalGrossProfitISK)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Before shipping
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="text-sm font-medium flex items-center gap-1.5">
                  <Ship className="h-4 w-4" />
                  Shipping Cost
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tabular-nums">
                  {formatISK(data.totalShippingISK)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total transport fees
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="text-sm font-medium flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4" />
                  Net Profit
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tabular-nums text-emerald-600">
                  {formatISK(data.totalNetProfitISK)}
                </div>
                <p className="text-xs text-emerald-600 mt-1 font-medium">
                  {(
                    (data.totalNetProfitISK / data.totalSpendISK) *
                    100
                  ).toFixed(1)}
                  % ROI
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Planning Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Planning Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {data.notes.map((n, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-muted-foreground">•</span>
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Packages by Destination */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Packages by Destination</h2>
            {Object.values(groupedByDest).map((pkgs, idx) => {
              const destId = pkgs[0].destinationStationId;
              const destName = pkgs[0].destinationName || `Station ${destId}`;
              const totalSpend = pkgs.reduce((s, p) => s + p.spendISK, 0);
              const totalProfit = pkgs.reduce((s, p) => s + p.netProfitISK, 0);

              return (
                <Card key={idx}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{destName}</CardTitle>
                        <CardDescription>Station ID: {destId}</CardDescription>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">
                          {pkgs.length} package{pkgs.length !== 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Destination Summary */}
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="p-3 rounded-lg bg-muted/50">
                        <div className="text-xs text-muted-foreground">
                          Total Spend
                        </div>
                        <div className="text-lg font-semibold tabular-nums">
                          {formatISK(totalSpend)}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50">
                        <div className="text-xs text-muted-foreground">
                          Net Profit
                        </div>
                        <div className="text-lg font-semibold tabular-nums text-emerald-600">
                          {formatISK(totalProfit)}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50">
                        <div className="text-xs text-muted-foreground">ROI</div>
                        <div className="text-lg font-semibold tabular-nums">
                          {((totalProfit / totalSpend) * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    {/* Packages List */}
                    <div className="space-y-2">
                      <div className="text-sm font-semibold mb-3">
                        Packages ({pkgs.length})
                      </div>
                      {pkgs.map((pkg) => {
                        const packageKey = `${destId}-${pkg.packageIndex}`;
                        const packageCopyText =
                          copyTextByPackage[packageKey] || "";

                        return (
                          <Collapsible key={pkg.packageIndex}>
                            <div className="border rounded-lg">
                              <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                                <CollapsibleTrigger className="flex items-center gap-3 flex-1 text-left">
                                  <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                                  <div>
                                    <div className="font-medium">
                                      Package #{pkg.packageIndex}
                                      {pkg.courierContractLabel ||
                                      pkg.courierContractId ? (
                                        <span className="ml-2 inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                                          {(
                                            pkg.courierContractLabel ??
                                            pkg.courierContractId
                                          )?.toString()}
                                        </span>
                                      ) : null}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {pkg.items.length} items •{" "}
                                      {formatISK(pkg.spendISK)}
                                    </div>
                                  </div>
                                </CollapsibleTrigger>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    handleCopyList(packageKey, packageCopyText)
                                  }
                                  className="gap-2"
                                >
                                  {copiedDest === packageKey ? (
                                    <>
                                      <Check className="h-4 w-4" />
                                      Copied
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-4 w-4" />
                                      Copy
                                    </>
                                  )}
                                </Button>
                              </div>
                              <CollapsibleContent>
                                <div className="border-t p-4 bg-muted/20">
                                  <div className="grid gap-4 sm:grid-cols-2">
                                    {/* Package Details */}
                                    <div className="space-y-2 text-sm">
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                          Spend:
                                        </span>
                                        <span className="font-medium tabular-nums">
                                          {formatISK(pkg.spendISK)}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                          Gross Profit:
                                        </span>
                                        <span className="font-medium tabular-nums text-emerald-600">
                                          {formatISK(pkg.grossProfitISK)}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                          Shipping:
                                        </span>
                                        <span className="font-medium tabular-nums">
                                          {formatISK(pkg.shippingISK)}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                          Net Profit:
                                        </span>
                                        <span className="font-medium tabular-nums text-emerald-600">
                                          {formatISK(pkg.netProfitISK)}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                          Capacity Used:
                                        </span>
                                        <span className="font-medium tabular-nums">
                                          {pkg.usedCapacityM3.toLocaleString()}{" "}
                                          m³
                                        </span>
                                      </div>
                                      <div className="flex justify-between pt-2 border-t">
                                        <span className="text-muted-foreground">
                                          Efficiency:
                                        </span>
                                        <span className="font-semibold">
                                          {(pkg.efficiency * 100).toFixed(1)}%
                                          ROI
                                        </span>
                                      </div>
                                    </div>

                                    {/* Items List */}
                                    <div className="max-h-60 overflow-y-auto border rounded-md bg-background">
                                      <div className="divide-y">
                                        {pkg.items
                                          .sort((a, b) =>
                                            a.name.localeCompare(b.name),
                                          )
                                          .map((it, i) => (
                                            <div
                                              key={`${it.typeId}-${i}`}
                                              className="flex justify-between gap-4 p-2 text-xs hover:bg-muted/50"
                                            >
                                              <span
                                                className="truncate"
                                                title={it.name}
                                              >
                                                {it.name}
                                              </span>
                                              <span className="tabular-nums font-medium">
                                                {it.units}
                                              </span>
                                            </div>
                                          ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
