import { Injectable } from '@nestjs/common';

import {
  CourierContractPreset,
  DestinationConfig,
  MultiPlanOptions,
  PackagePlan,
  PlanResult,
  PackedUnit,
} from './interfaces/packager.interfaces';

type ItemState = {
  typeId: number;
  name: string;
  unitCost: number;
  unitProfit: number;
  unitVolume: number;
  remainingUnits: number;
};

@Injectable()
export class ArbitragePackagerService {
  constructor() {}

  /**
   * Build the single best profitable package for ONE destination (given current budget & exposure).
   * Greedy by profit density (profit/m3). Returns null if no profitable package can be built.
   */
  buildBestPackageForDestination(params: {
    destinationStationId: number;
    shippingCostISK: number;
    itemsState: ItemState[];
    packageCapacityM3: number;
    budgetLeft: number;
    // per-destination item cap (in ISK) = share * totalInvestment
    perItemBudgetCapISK: number;
    itemExposureForDest: Record<number, { spendISK: number; units: number }>;
    maxPackageCollateralISK: number;
    shippingMarginMultiplier: number;
    densityWeight: number;
  }): Omit<
    PackagePlan,
    'packageIndex' | 'efficiency' | 'courierContractId' | 'courierContractLabel'
  > | null {
    const {
      destinationStationId,
      shippingCostISK,
      itemsState,
      packageCapacityM3,
      perItemBudgetCapISK,
      itemExposureForDest,
      maxPackageCollateralISK,
      shippingMarginMultiplier,
      densityWeight,
    } = params;

    if (params.budgetLeft < shippingCostISK) return null;

    // Item Prioritization: blend density (profit/m³) and ROI (profit/cost)
    // densityWeight = 1.0 → pure density (space-limited, default)
    // densityWeight = 0.0 → pure ROI (capital-limited)
    // densityWeight = 0.5 → equal blend
    const sorted = itemsState
      .filter(
        (it) =>
          it.unitProfit > 0 &&
          it.unitVolume > 0 &&
          it.unitCost > 0 &&
          it.remainingUnits > 0,
      )
      .sort((a, b) => {
        const densA = a.unitProfit / a.unitVolume;
        const densB = b.unitProfit / b.unitVolume;
        const roiA = a.unitProfit / a.unitCost;
        const roiB = b.unitProfit / b.unitCost;

        // Normalize to 0-1 range for fair blending (using max observed values)
        // In practice, we blend: scoreA = densityWeight * (densA/maxDens) + (1-densityWeight) * (roiA/maxRoi)
        // For simplicity, blend raw scores weighted by densityWeight
        const scoreA =
          densityWeight * densA + (1 - densityWeight) * roiA * 1000; // scale ROI to similar magnitude
        const scoreB =
          densityWeight * densB + (1 - densityWeight) * roiB * 1000;

        if (Math.abs(scoreA - scoreB) > 0.0001) return scoreB - scoreA;
        // Tie-breaker: if scores are equal, prefer lower cost (easier to fit)
        return a.unitCost - b.unitCost;
      });

    if (sorted.length === 0) return null;

    let volumeLeft = packageCapacityM3;
    let budgetLeft = params.budgetLeft;
    let collateralUsed = 0;

    const chosen: PackedUnit[] = [];
    let boxProfit = 0;

    function maxFeasibleUnits(it: ItemState): number {
      if (it.remainingUnits <= 0) return 0;
      const byVolume = Math.floor(volumeLeft / it.unitVolume);
      const byBudget = Math.floor(budgetLeft / it.unitCost);
      const exposure = itemExposureForDest[it.typeId]?.spendISK ?? 0;
      const remainingCapISK = Math.max(0, perItemBudgetCapISK - exposure);
      const byItemCap = Math.floor(remainingCapISK / it.unitCost);
      // Collateral constraint: don't exceed max package collateral
      const collateralLeft = Math.max(
        0,
        maxPackageCollateralISK - collateralUsed,
      );
      const byCollateral = Math.floor(collateralLeft / it.unitCost);
      return Math.max(
        0,
        Math.min(
          byVolume,
          byBudget,
          byItemCap,
          byCollateral,
          it.remainingUnits,
        ),
      );
    }

    let progressed = true;
    while (progressed) {
      progressed = false;
      for (const it of sorted) {
        const feas = maxFeasibleUnits(it);
        if (feas <= 0) continue;

        const take = feas;
        const spendAdd = take * it.unitCost;
        const profitAdd = take * it.unitProfit;
        const volAdd = take * it.unitVolume;

        chosen.push({
          typeId: it.typeId,
          name: it.name,
          units: take,
          unitCost: it.unitCost,
          unitProfit: it.unitProfit,
          unitVolume: it.unitVolume,
          spendISK: spendAdd,
          profitISK: profitAdd,
          volumeM3: volAdd,
        });

        it.remainingUnits -= take;
        budgetLeft -= spendAdd;
        volumeLeft -= volAdd;
        collateralUsed += spendAdd;
        boxProfit += profitAdd;

        progressed = true;

        if (volumeLeft < 1e-6) break;
        const minUnitCost = sorted.reduce(
          (m, x) => (x.unitCost < m ? x.unitCost : m),
          Number.POSITIVE_INFINITY,
        );
        if (budgetLeft < minUnitCost) break;
      }
    }

    if (chosen.length === 0) return null;

    // Shipping Margin Check: require boxProfit >= shippingCost * multiplier
    // Example: multiplier=1.5 means package must earn 50% more gross profit than shipping cost
    const requiredProfit = shippingCostISK * shippingMarginMultiplier;
    if (boxProfit < requiredProfit) return null;

    const filtered = chosen.filter((x) => x.units > 0);
    return {
      destinationStationId,
      items: filtered,
      spendISK: filtered.reduce((s, x) => s + x.spendISK, 0),
      grossProfitISK: filtered.reduce((s, x) => s + x.profitISK, 0),
      shippingISK: shippingCostISK,
      netProfitISK:
        filtered.reduce((s, x) => s + x.profitISK, 0) - shippingCostISK,
      usedCapacityM3: filtered.reduce((s, x) => s + x.volumeM3, 0),
    };
  }

  private resolveCourierContracts(
    opts: MultiPlanOptions,
  ): CourierContractPreset[] {
    const maxPackageCollateralISK =
      opts.maxPackageCollateralISK ?? 5_000_000_000;
    const fallback: CourierContractPreset = {
      id: 'default',
      label: 'Default',
      maxVolumeM3: opts.packageCapacityM3,
      maxCollateralISK: maxPackageCollateralISK,
    };

    const list = (opts.courierContracts ?? []).filter(
      (c) => c && c.maxVolumeM3 > 0 && c.maxCollateralISK >= 0,
    );

    return list.length > 0 ? list : [fallback];
  }

  private pickBestCourierCandidate(params: {
    destinationStationId: number;
    shippingCostISK: number;
    itemsState: ItemState[];
    budgetLeft: number;
    perItemBudgetCapISK: number;
    itemExposureForDest: Record<number, { spendISK: number; units: number }>;
    courierContracts: CourierContractPreset[];
    shippingMarginMultiplier: number;
    densityWeight: number;
  }):
    | (Omit<PackagePlan, 'packageIndex' | 'efficiency'> & {
        courierContractId: string;
        courierContractLabel: string;
        courierMaxVolumeM3: number;
        courierMaxCollateralISK: number;
      })
    | null {
    const {
      destinationStationId,
      shippingCostISK,
      itemsState,
      budgetLeft,
      perItemBudgetCapISK,
      itemExposureForDest,
      courierContracts,
      shippingMarginMultiplier,
      densityWeight,
    } = params;

    const candidates: Array<{
      courier: CourierContractPreset;
      cand: ReturnType<typeof this.buildBestPackageForDestination>;
    }> = [];

    for (const courier of courierContracts) {
      const simulated = itemsState.map((x) => ({ ...x }));
      const cand = this.buildBestPackageForDestination({
        destinationStationId,
        shippingCostISK,
        itemsState: simulated,
        packageCapacityM3: courier.maxVolumeM3,
        budgetLeft,
        perItemBudgetCapISK,
        itemExposureForDest,
        maxPackageCollateralISK: courier.maxCollateralISK,
        shippingMarginMultiplier,
        densityWeight,
      });
      if (!cand) continue;
      candidates.push({ courier, cand });
    }

    if (candidates.length === 0) return null;

    // Choose best overall by efficiency (ROI), then net profit.
    candidates.sort((a, b) => {
      const effA = a.cand!.netProfitISK / Math.max(1, a.cand!.spendISK);
      const effB = b.cand!.netProfitISK / Math.max(1, b.cand!.spendISK);
      if (Math.abs(effA - effB) > 1e-9) return effB - effA;
      return (b.cand?.netProfitISK ?? 0) - (a.cand?.netProfitISK ?? 0);
    });

    const bestOverall = candidates[0];

    // Courier preference rule (safety-first):
    // If the best overall package would fit inside the *first* courier preset,
    // we prefer that first courier (e.g., Blockade) when possible.
    const preferred = courierContracts[0];
    const fitsPreferred =
      preferred.maxVolumeM3 >= bestOverall.cand!.usedCapacityM3 &&
      preferred.maxCollateralISK >= bestOverall.cand!.spendISK;

    const preferredCand = candidates.find((c) => c.courier.id === preferred.id);

    const chosen =
      fitsPreferred && preferredCand
        ? preferredCand
        : fitsPreferred
          ? { courier: preferred, cand: bestOverall.cand }
          : bestOverall;

    return {
      ...chosen.cand,
      courierContractId: chosen.courier.id,
      courierContractLabel: chosen.courier.label,
      courierMaxVolumeM3: chosen.courier.maxVolumeM3,
      courierMaxCollateralISK: chosen.courier.maxCollateralISK,
    };
  }

  private commitBestCourierPackage(params: {
    destinationStationId: number;
    shippingCostISK: number;
    itemsState: ItemState[];
    budgetLeft: number;
    perItemBudgetCapISK: number;
    itemExposureForDest: Record<number, { spendISK: number; units: number }>;
    courierContracts: CourierContractPreset[];
    shippingMarginMultiplier: number;
    densityWeight: number;
  }):
    | (Omit<PackagePlan, 'packageIndex' | 'efficiency'> & {
        courierContractId: string;
        courierContractLabel: string;
        courierMaxVolumeM3: number;
        courierMaxCollateralISK: number;
      })
    | null {
    // Evaluate on copies to choose best courier, then commit exact chosen items to real refs.
    // This guarantees the committed package matches the evaluated one (and avoids re-greedy differences).
    const evaluated = this.pickBestCourierCandidate(params);
    if (!evaluated) return null;

    // Apply evaluated package to real state
    const unitsByType = new Map<number, number>();
    for (const it of evaluated.items) {
      unitsByType.set(it.typeId, (unitsByType.get(it.typeId) ?? 0) + it.units);
    }
    for (const [typeId, units] of unitsByType.entries()) {
      const st = params.itemsState.find((x) => x.typeId === typeId);
      if (!st || st.remainingUnits < units) {
        return null;
      }
      st.remainingUnits -= units;
    }

    return evaluated;
  }

  /**
   * Multi-destination planner:
   * - Enforces 20% (default) global cap per item across ALL destinations (risk spread).
   * - Iteratively builds the best next profitable package among destinations (by netProfit/spend),
   *   commits it, and repeats until budget/items exhausted or package limit reached.
   */
  planMultiDestination(
    destinationsIn: DestinationConfig[],
    opts: MultiPlanOptions,
  ): PlanResult {
    const {
      packageCapacityM3,
      investmentISK,
      perDestinationMaxBudgetSharePerItem = 0.2,
      maxPackagesHint = 30,
      maxPackageCollateralISK = 5_000_000_000, // 5B ISK default
      courierContracts,
      minPackageNetProfitISK, // undefined = no threshold
      minPackageROIPercent, // undefined = no threshold
      shippingMarginMultiplier = 1.0, // default 1.0 = break-even
      densityWeight = 1.0, // default 1.0 = pure density (space-limited); 0.0 = pure ROI (capital-limited)
      destinationCaps = {},
      allocation = {},
    } = opts;

    const mode = allocation.mode ?? 'best';
    const spreadBias = allocation.spreadBias ?? 0.5;
    const effectiveCouriers = this.resolveCourierContracts({
      ...opts,
      courierContracts,
      packageCapacityM3,
      maxPackageCollateralISK,
    });

    // Build mutable state per destination
    const destStates = destinationsIn.map((d) => ({
      destinationStationId: d.destinationStationId,
      shippingCostISK: d.shippingCostISK,
      itemsState: d.items.map((it) => ({
        typeId: it.typeId,
        name: it.name,
        unitCost: it.sourcePrice,
        unitProfit: it.netProfitISK ?? it.destinationPrice - it.sourcePrice,
        unitVolume: it.m3,
        remainingUnits: Math.max(0, it.arbitrageQuantity),
      })) as ItemState[],
    }));

    // Exposure per destination per item
    const itemExposureByDest: Record<
      number,
      Record<number, { spendISK: number; units: number }>
    > = {};
    for (const d of destStates) itemExposureByDest[d.destinationStationId] = {};

    // Destination spend tracker
    const destSpend: Record<number, number> = {};
    for (const d of destStates) destSpend[d.destinationStationId] = 0;

    // Default equal target shares if not provided
    const defaultTarget = 1 / Math.max(1, destStates.length);
    const targets: Record<number, number> = {};
    for (const d of destStates) {
      targets[d.destinationStationId] =
        allocation.targets?.[d.destinationStationId] ?? defaultTarget;
    }

    // helper: check hard caps for a candidate
    function violatesCaps(destId: number, addedSpend: number): boolean {
      const caps = destinationCaps[destId];
      if (!caps) return false;
      const newSpend = destSpend[destId] + addedSpend;
      if (caps.maxISK != null && newSpend > caps.maxISK) return true;
      if (caps.maxShare != null && newSpend / investmentISK > caps.maxShare)
        return true;
      return false;
    }

    let budgetLeft = investmentISK;
    const packages: PackagePlan[] = [];
    const notes: string[] = [];
    let pkgIndex = 1;

    // Round-robin pointer
    let rrIndex = 0;

    while (pkgIndex <= maxPackagesHint && budgetLeft > 0) {
      // Build candidates
      const candidateSet: Array<{
        cand: Omit<PackagePlan, 'packageIndex' | 'efficiency'>;
        idx: number;
        score: number;
      }> = [];

      const destOrder = (() => {
        if (mode !== 'roundRobin') return destStates.map((_, i) => i);
        const order: number[] = [];
        for (let k = 0; k < destStates.length; k++)
          order.push((rrIndex + k) % destStates.length);
        return order;
      })();

      for (const i of destOrder) {
        const d = destStates[i];

        // Skip if even the shipping cost would break hard caps
        if (violatesCaps(d.destinationStationId, 0)) continue;

        const perItemCapISK =
          perDestinationMaxBudgetSharePerItem * investmentISK;
        const cand = this.pickBestCourierCandidate({
          destinationStationId: d.destinationStationId,
          shippingCostISK: d.shippingCostISK,
          itemsState: d.itemsState, // simulated internally per courier
          budgetLeft,
          perItemBudgetCapISK: perItemCapISK,
          itemExposureForDest: itemExposureByDest[d.destinationStationId],
          courierContracts: effectiveCouriers,
          shippingMarginMultiplier,
          densityWeight,
        });

        if (!cand) {
          if (mode === 'roundRobin') {
            // in round-robin, if next destination can't form a box, try next in order
            continue;
          }
          // otherwise just skip
          continue;
        }

        // Hard caps check with the *spend* of this candidate
        if (violatesCaps(d.destinationStationId, cand.spendISK)) continue;

        // Package Quality Thresholds: reject packages below minimum standards
        if (
          minPackageNetProfitISK !== undefined &&
          cand.netProfitISK < minPackageNetProfitISK
        ) {
          continue; // package doesn't meet minimum profit threshold
        }
        if (minPackageROIPercent !== undefined) {
          const roiPercent =
            (cand.netProfitISK / Math.max(1, cand.spendISK)) * 100;
          if (roiPercent < minPackageROIPercent) {
            continue; // package doesn't meet minimum ROI threshold
          }
        }

        // Scoring
        const eff = cand.netProfitISK / Math.max(1, cand.spendISK);
        let score = eff; // base: ROI

        if (mode === 'targetWeighted') {
          const currentShare =
            destSpend[d.destinationStationId] / Math.max(1, investmentISK);
          const target = targets[d.destinationStationId] ?? defaultTarget;
          // If under target, boost; if over, penalize. Tuned by spreadBias.
          score = eff * (1 + spreadBias * (target - currentShare));
        } else if (mode === 'roundRobin') {
          // round-robin uses the first feasible in order, so score mainly for tie-break
          score = eff;
        } // 'best' -> score = eff

        candidateSet.push({ cand, idx: i, score });
        if (mode === 'roundRobin' && candidateSet.length > 0) break; // take first feasible in RR
      }

      if (candidateSet.length === 0) {
        notes.push(
          'No further profitable packages can be built under current caps/allocation.',
        );
        break;
      }

      // Pick best by score (tie-break by higher net profit)
      candidateSet.sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score;
        return b.cand.netProfitISK - a.cand.netProfitISK;
      });
      const best = candidateSet[0];

      // Commit against real state (not the simulated copy)
      const chosenDest = destStates[best.idx];
      const perItemCapISK = perDestinationMaxBudgetSharePerItem * investmentISK;
      const committed = this.commitBestCourierPackage({
        destinationStationId: chosenDest.destinationStationId,
        shippingCostISK: chosenDest.shippingCostISK,
        itemsState: chosenDest.itemsState, // real refs
        budgetLeft,
        perItemBudgetCapISK: perItemCapISK,
        itemExposureForDest:
          itemExposureByDest[chosenDest.destinationStationId],
        courierContracts: effectiveCouriers,
        shippingMarginMultiplier,
        densityWeight,
      });

      if (!committed) {
        // extremely unlikely race; try next best once
        candidateSet.shift();
        if (candidateSet.length === 0) break;
        const next = candidateSet[0];
        const nextDest = destStates[next.idx];
        const committed2 = this.commitBestCourierPackage({
          destinationStationId: nextDest.destinationStationId,
          shippingCostISK: nextDest.shippingCostISK,
          itemsState: nextDest.itemsState,
          budgetLeft,
          perItemBudgetCapISK: perItemCapISK,
          itemExposureForDest:
            itemExposureByDest[nextDest.destinationStationId],
          courierContracts: effectiveCouriers,
          shippingMarginMultiplier,
          densityWeight,
        });
        if (!committed2) break; // give up this round
        // use committed2
        const eff2 = committed2.netProfitISK / Math.max(1, committed2.spendISK);
        packages.push({
          packageIndex: pkgIndex++,
          destinationStationId: committed2.destinationStationId,
          courierContractId: committed2.courierContractId,
          courierContractLabel: committed2.courierContractLabel,
          courierMaxVolumeM3: committed2.courierMaxVolumeM3,
          courierMaxCollateralISK: committed2.courierMaxCollateralISK,
          items: committed2.items,
          spendISK: committed2.spendISK,
          grossProfitISK: committed2.grossProfitISK,
          shippingISK: committed2.shippingISK,
          netProfitISK: committed2.netProfitISK,
          usedCapacityM3: committed2.usedCapacityM3,
          efficiency: eff2,
        });
        budgetLeft -= committed2.spendISK;
        destSpend[committed2.destinationStationId] += committed2.spendISK;
        for (const ch of committed2.items) {
          const slot = itemExposureByDest[committed2.destinationStationId][
            ch.typeId
          ] ?? { spendISK: 0, units: 0 };
          slot.spendISK += ch.spendISK;
          slot.units += ch.units;
          itemExposureByDest[committed2.destinationStationId][ch.typeId] = slot;
        }
      } else {
        // normal path
        const eff = committed.netProfitISK / Math.max(1, committed.spendISK);
        packages.push({
          packageIndex: pkgIndex++,
          destinationStationId: committed.destinationStationId,
          courierContractId: committed.courierContractId,
          courierContractLabel: committed.courierContractLabel,
          courierMaxVolumeM3: committed.courierMaxVolumeM3,
          courierMaxCollateralISK: committed.courierMaxCollateralISK,
          items: committed.items,
          spendISK: committed.spendISK,
          grossProfitISK: committed.grossProfitISK,
          shippingISK: committed.shippingISK,
          netProfitISK: committed.netProfitISK,
          usedCapacityM3: committed.usedCapacityM3,
          efficiency: eff,
        });
        budgetLeft -= committed.spendISK;
        destSpend[committed.destinationStationId] += committed.spendISK;
        for (const ch of committed.items) {
          const slot = itemExposureByDest[committed.destinationStationId][
            ch.typeId
          ] ?? { spendISK: 0, units: 0 };
          slot.spendISK += ch.spendISK;
          slot.units += ch.units;
          itemExposureByDest[committed.destinationStationId][ch.typeId] = slot;
        }
      }

      if (mode === 'roundRobin') {
        rrIndex = (rrIndex + 1) % destStates.length; // move pointer
      }

      // stop if we can't even afford the cheapest shipping next
      const minShip = Math.min(...destStates.map((d) => d.shippingCostISK));
      if (budgetLeft < minShip) break;
    }

    const totalSpendISK = packages.reduce((s, p) => s + p.spendISK, 0);
    const totalGrossProfitISK = packages.reduce(
      (s, p) => s + p.grossProfitISK,
      0,
    );
    const totalShippingISK = packages.reduce((s, p) => s + p.shippingISK, 0);
    const totalNetProfitISK = packages.reduce((s, p) => s + p.netProfitISK, 0);

    notes.push(
      `Per-destination item cap: ≤ ${(perDestinationMaxBudgetSharePerItem * 100).toFixed(0)}% of total budget per item (per destination).`,
      `Max package collateral (legacy/default): ${(maxPackageCollateralISK / 1_000_000_000).toFixed(1)}B ISK.`,
      `Max packages considered: ${maxPackagesHint}.`,
      `Shipping margin multiplier: ${shippingMarginMultiplier.toFixed(1)}× (requires box profit ≥ ${shippingMarginMultiplier.toFixed(1)}× shipping cost).`,
      `Density weight: ${densityWeight.toFixed(2)} (${densityWeight === 1 ? 'pure density/space-limited' : densityWeight === 0 ? 'pure ROI/capital-limited' : 'blended strategy'}).`,
      `Allocation mode: ${mode}${mode === 'targetWeighted' ? ` (bias=${spreadBias}, targets=${JSON.stringify(targets)})` : ''}.`,
    );

    // Courier usage notes
    const courierCounts = packages.reduce<Record<string, number>>((acc, p) => {
      const k = p.courierContractId ?? 'default';
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});
    if (effectiveCouriers.length > 1) {
      notes.push(
        `Courier contracts enabled: ${effectiveCouriers.map((c) => `${c.label}(${Math.round(c.maxVolumeM3).toLocaleString()} m³ / ${(c.maxCollateralISK / 1_000_000_000).toFixed(1)}B)`).join(', ')}.`,
        `Packages by courier: ${Object.entries(courierCounts)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ')}.`,
      );
    }

    // Add quality threshold notes if set
    if (minPackageNetProfitISK !== undefined) {
      notes.push(
        `Min package net profit: ${(minPackageNetProfitISK / 1_000_000).toFixed(1)}M ISK (rejects low-value packages).`,
      );
    }
    if (minPackageROIPercent !== undefined) {
      notes.push(
        `Min package ROI: ${minPackageROIPercent.toFixed(1)}% (rejects low-efficiency packages).`,
      );
    }

    return {
      packages,
      totalSpendISK,
      totalGrossProfitISK,
      totalShippingISK,
      totalNetProfitISK,
      itemExposureByDest,
      destSpend,
      notes,
    };
  }
}
