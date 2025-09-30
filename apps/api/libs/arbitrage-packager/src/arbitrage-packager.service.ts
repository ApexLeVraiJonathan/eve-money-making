import { Injectable } from '@nestjs/common';

import {
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
  }): Omit<PackagePlan, 'packageIndex' | 'efficiency'> | null {
    const {
      destinationStationId,
      shippingCostISK,
      itemsState,
      packageCapacityM3,
      perItemBudgetCapISK,
      itemExposureForDest,
    } = params;

    if (params.budgetLeft < shippingCostISK) return null;

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
        if (densA !== densB) return densB - densA;
        const roiA = a.unitProfit / a.unitCost;
        const roiB = b.unitProfit / b.unitCost;
        return roiB - roiA;
      });

    if (sorted.length === 0) return null;

    let volumeLeft = packageCapacityM3;
    let budgetLeft = params.budgetLeft;

    const chosen: PackedUnit[] = [];
    let boxProfit = 0;

    function maxFeasibleUnits(it: ItemState): number {
      if (it.remainingUnits <= 0) return 0;
      const byVolume = Math.floor(volumeLeft / it.unitVolume);
      const byBudget = Math.floor(budgetLeft / it.unitCost);
      const exposure = itemExposureForDest[it.typeId]?.spendISK ?? 0;
      const remainingCapISK = Math.max(0, perItemBudgetCapISK - exposure);
      const byItemCap = Math.floor(remainingCapISK / it.unitCost);
      return Math.max(
        0,
        Math.min(byVolume, byBudget, byItemCap, it.remainingUnits),
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
    if (boxProfit < shippingCostISK) return null;

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
      destinationCaps = {},
      allocation = {},
    } = opts;

    const mode = allocation.mode ?? 'best';
    const spreadBias = allocation.spreadBias ?? 0.5;

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
        const cand = this.buildBestPackageForDestination({
          destinationStationId: d.destinationStationId,
          shippingCostISK: d.shippingCostISK,
          itemsState: d.itemsState.map((x) => ({ ...x })), // simulate
          packageCapacityM3,
          budgetLeft,
          perItemBudgetCapISK: perItemCapISK,
          itemExposureForDest: itemExposureByDest[d.destinationStationId],
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
      const committed = this.buildBestPackageForDestination({
        destinationStationId: chosenDest.destinationStationId,
        shippingCostISK: chosenDest.shippingCostISK,
        itemsState: chosenDest.itemsState, // real refs
        packageCapacityM3,
        budgetLeft,
        perItemBudgetCapISK: perItemCapISK,
        itemExposureForDest:
          itemExposureByDest[chosenDest.destinationStationId],
      });

      if (!committed) {
        // extremely unlikely race; try next best once
        candidateSet.shift();
        if (candidateSet.length === 0) break;
        const next = candidateSet[0];
        const nextDest = destStates[next.idx];
        const committed2 = this.buildBestPackageForDestination({
          destinationStationId: nextDest.destinationStationId,
          shippingCostISK: nextDest.shippingCostISK,
          itemsState: nextDest.itemsState,
          packageCapacityM3,
          budgetLeft,
          perItemBudgetCapISK: perItemCapISK,
          itemExposureForDest:
            itemExposureByDest[nextDest.destinationStationId],
        });
        if (!committed2) break; // give up this round
        // use committed2
        const eff2 = committed2.netProfitISK / Math.max(1, committed2.spendISK);
        packages.push({
          packageIndex: pkgIndex++,
          destinationStationId: committed2.destinationStationId,
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
      `Max packages considered: ${maxPackagesHint}.`,
      `Allocation mode: ${mode}${mode === 'targetWeighted' ? ` (bias=${spreadBias}, targets=${JSON.stringify(targets)})` : ''}.`,
    );

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
