import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { PlanResult } from '../../../libs/arbitrage-packager/src/interfaces/packager.interfaces';

@Injectable()
export class PackageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
  ) {}

  /**
   * Get all committed packages for a cycle, optionally filtered by status
   */
  async getCommittedPackages(cycleId: string, status?: string) {
    const where: any = { cycleId };
    if (status) {
      where.status = status;
    }

    const packages = await this.prisma.committedPackage.findMany({
      where,
      include: {
        items: {
          select: {
            id: true,
            typeId: true,
            typeName: true,
            units: true,
            unitCost: true,
            unitProfit: true,
          },
        },
        cycleLineLinks: {
          select: {
            id: true,
            unitsCommitted: true,
          },
        },
      },
      orderBy: [{ committedAt: 'desc' }, { packageIndex: 'asc' }],
    });

    // Fetch type volumes for all items
    const allTypeIds = [
      ...new Set(
        packages.flatMap((pkg) => pkg.items.map((item) => item.typeId)),
      ),
    ];
    const typeVolumes = await this.prisma.typeId.findMany({
      where: { id: { in: allTypeIds } },
      select: { id: true, volume: true },
    });
    const volumeMap = new Map(
      typeVolumes.map((t) => [t.id, Number(t.volume ?? 0)]),
    );

    return packages.map((pkg) => {
      const totalVolume = pkg.items.reduce((sum, item) => {
        const unitVolume = volumeMap.get(item.typeId) ?? 0;
        return sum + unitVolume * item.units;
      }, 0);

      return {
        id: pkg.id,
        cycleId: pkg.cycleId,
        packageIndex: pkg.packageIndex,
        destinationStationId: pkg.destinationStationId,
        destinationName: pkg.destinationName,
        collateralIsk: pkg.collateralIsk.toString(),
        shippingCostIsk: pkg.shippingCostIsk.toString(),
        estimatedProfitIsk: pkg.estimatedProfitIsk.toString(),
        status: pkg.status,
        committedAt: pkg.committedAt.toISOString(),
        failedAt: pkg.failedAt?.toISOString() ?? null,
        collateralRecoveredIsk: pkg.collateralRecoveredIsk?.toString() ?? null,
        failureMemo: pkg.failureMemo,
        itemCount: pkg.items.length,
        totalUnits: pkg.items.reduce((sum, item) => sum + item.units, 0),
        totalVolumeM3: totalVolume.toFixed(2),
        items: pkg.items.map((item) => ({
          id: item.id,
          typeId: item.typeId,
          typeName: item.typeName,
          units: item.units,
          unitCost: item.unitCost.toString(),
          unitProfit: item.unitProfit.toString(),
        })),
      };
    });
  }

  /**
   * Get detailed information about a specific package
   */
  async getPackageDetails(packageId: string) {
    const pkg = await this.prisma.committedPackage.findUnique({
      where: { id: packageId },
      include: {
        items: {
          orderBy: { typeName: 'asc' },
        },
        cycleLineLinks: {
          include: {
            cycleLine: {
              select: {
                id: true,
                typeId: true,
                destinationStationId: true,
                plannedUnits: true,
                unitsBought: true,
                unitsSold: true,
                buyCostIsk: true,
              },
            },
          },
        },
      },
    });

    if (!pkg) {
      throw new NotFoundException(`Package ${packageId} not found`);
    }

    // Build detailed linked cycle line diagnostics
    const linkedCycleLines = pkg.cycleLineLinks.map((link) => {
      const cycleLine = link.cycleLine;
      const hasSalesForLine = cycleLine.unitsSold > 0;

      // How many units from this cycle line can be removed while preserving sales
      const maxRemovable = Math.max(
        0,
        cycleLine.unitsBought - cycleLine.unitsSold,
      );
      const lostUnitsCandidate = Math.min(link.unitsCommitted, maxRemovable);

      // Try to enrich with type name from package items (if present)
      const matchedItem = pkg.items.find(
        (item) => item.typeId === cycleLine.typeId,
      );

      return {
        cycleLineId: cycleLine.id,
        typeId: cycleLine.typeId,
        typeName: matchedItem?.typeName ?? null,
        unitsCommitted: link.unitsCommitted,
        plannedUnits: cycleLine.plannedUnits,
        unitsBought: cycleLine.unitsBought,
        unitsSold: cycleLine.unitsSold,
        buyCostIsk: cycleLine.buyCostIsk.toString(),
        hasSales: hasSalesForLine,
        maxRemovableUnits: maxRemovable,
        lostUnitsCandidate,
      };
    });

    const hasSales = linkedCycleLines.some((link) => link.hasSales);

    // By default, allow marking failed while package is active.
    let canMarkFailed = pkg.status === 'active';
    let validationMessage: string | null = null;

    if (!canMarkFailed) {
      validationMessage = `Package is already ${pkg.status} and cannot be marked as failed`;
    } else if (hasSales) {
      const linesWithSales = linkedCycleLines.filter((l) => l.hasSales);
      const example = linesWithSales[0];
      const exampleName =
        example?.typeName ?? `typeId=${example?.typeId ?? 'unknown'}`;
      const count = linesWithSales.length;
      validationMessage =
        count === 1
          ? `Warning: 1 linked cycle line (${exampleName}) already has sales. Only unsold units will be marked as lost.`
          : `Warning: ${count} linked cycle lines (e.g. ${exampleName}) already have sales. Only unsold units will be marked as lost.`;
    }

    return {
      id: pkg.id,
      cycleId: pkg.cycleId,
      packageIndex: pkg.packageIndex,
      destinationStationId: pkg.destinationStationId,
      destinationName: pkg.destinationName,
      collateralIsk: pkg.collateralIsk.toString(),
      shippingCostIsk: pkg.shippingCostIsk.toString(),
      estimatedProfitIsk: pkg.estimatedProfitIsk.toString(),
      status: pkg.status,
      committedAt: pkg.committedAt.toISOString(),
      failedAt: pkg.failedAt?.toISOString() ?? null,
      collateralRecoveredIsk: pkg.collateralRecoveredIsk?.toString() ?? null,
      failureMemo: pkg.failureMemo,
      items: pkg.items.map((item) => ({
        id: item.id,
        typeId: item.typeId,
        typeName: item.typeName,
        units: item.units,
        unitCost: item.unitCost.toString(),
        unitProfit: item.unitProfit.toString(),
      })),
      linkedCycleLines,
      canMarkFailed,
      validationMessage,
    };
  }

  /**
   * Create committed package records from a plan result
   * Called after creating cycle lines during commit
   */
  async createCommittedPackages(
    cycleId: string,
    planResult: PlanResult,
  ): Promise<string[]> {
    return await this.prisma.$transaction(async (tx) => {
      return await this._createCommittedPackagesCore(tx, cycleId, planResult);
    });
  }

  /**
   * Transaction-aware version for use within existing transactions
   */
  async createCommittedPackagesInTransaction(
    tx: any, // Prisma.TransactionClient
    cycleId: string,
    planResult: PlanResult,
  ): Promise<string[]> {
    return await this._createCommittedPackagesCore(tx, cycleId, planResult);
  }

  /**
   * Core implementation that works with either prisma client or transaction client
   */
  private async _createCommittedPackagesCore(
    client: any, // PrismaClient or Prisma.TransactionClient
    cycleId: string,
    planResult: PlanResult,
  ): Promise<string[]> {
    const packageIds: string[] = [];

    for (const pkg of planResult.packages) {
      // Create the package record
      const createdPackage = await client.committedPackage.create({
        data: {
          cycleId,
          packageIndex: pkg.packageIndex,
          destinationStationId: pkg.destinationStationId,
          destinationName: (pkg as any).destinationName ?? null,
          collateralIsk: pkg.spendISK.toFixed(2),
          shippingCostIsk: pkg.shippingISK.toFixed(2),
          estimatedProfitIsk: pkg.netProfitISK.toFixed(2),
          status: 'active',
        },
      });

      packageIds.push(createdPackage.id);

      // Create package items
      const itemsData = pkg.items.map((item) => ({
        packageId: createdPackage.id,
        typeId: item.typeId,
        typeName: item.name,
        units: item.units,
        unitCost: item.unitCost.toFixed(2),
        unitProfit: item.unitProfit.toFixed(2),
      }));

      await client.committedPackageItem.createMany({
        data: itemsData,
      });

      // Link to cycle lines
      // Aggregate units per typeId (multiple package items may map to same cycle line)
      const unitsByTypeId = new Map<number, number>();
      for (const item of pkg.items) {
        const current = unitsByTypeId.get(item.typeId) ?? 0;
        unitsByTypeId.set(item.typeId, current + item.units);
      }

      // Create junction records (one per unique typeId)
      for (const [typeId, totalUnits] of unitsByTypeId.entries()) {
        const cycleLine = await client.cycleLine.findFirst({
          where: {
            cycleId,
            typeId,
            destinationStationId: pkg.destinationStationId,
          },
        });

        if (cycleLine) {
          // Create junction record with aggregated units
          await client.packageCycleLine.create({
            data: {
              packageId: createdPackage.id,
              cycleLineId: cycleLine.id,
              unitsCommitted: totalUnits,
            },
          });
        } else {
          this.logger.warn(
            `No cycle line found for typeId=${typeId} dest=${pkg.destinationStationId} in cycle ${cycleId}`,
          );
        }
      }

      this.logger.log(
        `Created committed package #${pkg.packageIndex} (${createdPackage.id}) with ${pkg.items.length} items`,
      );
    }

    return packageIds;
  }

  /**
   * Mark a package as failed, reduce cycle line quantities/costs, and record collateral profit
   */
  async markPackageFailed(input: {
    packageId: string;
    collateralRecoveredIsk: string;
    collateralProfitIsk?: string;
    memo?: string;
  }) {
    return await this.prisma.$transaction(async (tx) => {
      // Get package with all links
      const pkg = await tx.committedPackage.findUnique({
        where: { id: input.packageId },
        include: {
          cycleLineLinks: {
            include: {
              cycleLine: true,
            },
          },
          items: true,
        },
      });

      if (!pkg) {
        throw new NotFoundException(`Package ${input.packageId} not found`);
      }

      if (pkg.status !== 'active') {
        throw new Error(
          `Package is already ${pkg.status} and cannot be marked as failed`,
        );
      }

      // Track total cost reduction (capital recovered by reducing buyCostIsk)
      let totalCostReduction = 0;

      // For each linked cycle line, reduce quantities and costs
      for (const link of pkg.cycleLineLinks) {
        const cycleLine = link.cycleLine;

        // Find the corresponding package item to get unit cost
        const packageItem = pkg.items.find(
          (item) => item.typeId === cycleLine.typeId,
        );

        if (!packageItem) {
          this.logger.warn(
            `No package item found for typeId=${cycleLine.typeId} in package ${input.packageId}`,
          );
          continue;
        }

        const unitCost = Number(packageItem.unitCost);

        // Calculate how many units can be removed while preserving sold units
        const maxRemovable = Math.max(
          0,
          cycleLine.unitsBought - cycleLine.unitsSold,
        );
        const lostUnits = Math.min(link.unitsCommitted, maxRemovable);

        if (lostUnits <= 0) {
          this.logger.warn(
            `No removable unsold units for cycle line ${cycleLine.id} when failing package ${input.packageId} (unitsBought=${cycleLine.unitsBought}, unitsSold=${cycleLine.unitsSold}, unitsCommitted=${link.unitsCommitted})`,
          );

          // We still remove the junction so this package no longer appears
          // linked to the cycle line, but we do not change the line totals.
          await tx.packageCycleLine.deleteMany({
            where: { id: link.id },
          });
          continue;
        }

        // Calculate cost reduction using only the removable (unsold) units
        const costReduction = lostUnits * unitCost;
        totalCostReduction += costReduction;

        // Update cycle line
        const newUnitsBought = cycleLine.unitsBought - lostUnits;
        const newPlannedUnitsRaw = cycleLine.plannedUnits - lostUnits;
        // Never drop planned units below unitsSold; preserve at least sold qty
        const newPlannedUnits = Math.max(
          newPlannedUnitsRaw,
          cycleLine.unitsSold,
        );
        const newBuyCostIsk = Number(cycleLine.buyCostIsk) - costReduction;

        // Delete the junction record first (before deleting cycle line)
        await tx.packageCycleLine.deleteMany({
          where: { id: link.id },
        });

        const shouldDeleteLine =
          cycleLine.unitsSold === 0 &&
          newUnitsBought <= 0 &&
          newPlannedUnits <= 0;

        if (shouldDeleteLine) {
          // Delete the cycle line entirely (only when there are no sales)
          await tx.cycleLine.delete({
            where: { id: cycleLine.id },
          });
          this.logger.log(
            `Deleted cycle line ${cycleLine.id} (no remaining units)`,
          );
        } else {
          // Update with reduced quantities
          await tx.cycleLine.update({
            where: { id: cycleLine.id },
            data: {
              plannedUnits: newPlannedUnits,
              unitsBought: newUnitsBought,
              buyCostIsk: newBuyCostIsk.toFixed(2),
            },
          });
          this.logger.log(
            `Reduced cycle line ${cycleLine.id}: -${lostUnits} units, -${costReduction.toFixed(2)} ISK`,
          );
        }
      }

      // Calculate collateral profit (margin above costs)
      // Admin can specify it, or we calculate: collateral recovered - cost reduction
      const collateralProfit = input.collateralProfitIsk
        ? Number(input.collateralProfitIsk)
        : Number(input.collateralRecoveredIsk) - totalCostReduction;

      // Update package status
      const updatedPackage = await tx.committedPackage.update({
        where: { id: input.packageId },
        data: {
          status: 'failed',
          failedAt: new Date(),
          collateralRecoveredIsk: input.collateralRecoveredIsk,
          failureMemo: input.memo ?? null,
        },
      });

      // Record only the profit portion as income (negative fee)
      // The cost reduction already recovered capital by reducing buyCostIsk
      if (collateralProfit > 0) {
        await tx.cycleFeeEvent.create({
          data: {
            cycleId: pkg.cycleId,
            feeType: 'collateral_recovery',
            amountIsk: `-${collateralProfit.toFixed(2)}`,
            occurredAt: new Date(),
            memo:
              input.memo ??
              `Package #${pkg.packageIndex} collateral profit (margin)`,
          },
        });
        this.logger.log(
          `Recorded collateral profit of ${collateralProfit.toFixed(2)} ISK for package ${input.packageId}`,
        );
      }

      this.logger.log(
        `Marked package ${input.packageId} as failed. Collateral recovered: ${input.collateralRecoveredIsk} ISK, Cost reduction: ${totalCostReduction.toFixed(2)} ISK, Profit: ${collateralProfit.toFixed(2)} ISK`,
      );

      return {
        id: updatedPackage.id,
        status: updatedPackage.status,
        failedAt: updatedPackage.failedAt?.toISOString() ?? null,
        collateralRecoveredIsk:
          updatedPackage.collateralRecoveredIsk?.toString() ?? null,
        collateralProfitIsk: collateralProfit.toFixed(2),
        totalCostReductionIsk: totalCostReduction.toFixed(2),
      };
    });
  }

  /**
   * Mark all active packages for a cycle as completed
   * Called when cycle is closed
   */
  async completePackagesForCycle(cycleId: string): Promise<number> {
    const result = await this.prisma.committedPackage.updateMany({
      where: {
        cycleId,
        status: 'active',
      },
      data: {
        status: 'completed',
      },
    });

    this.logger.log(
      `Marked ${result.count} active packages as completed for cycle ${cycleId}`,
    );

    return result.count;
  }
}
