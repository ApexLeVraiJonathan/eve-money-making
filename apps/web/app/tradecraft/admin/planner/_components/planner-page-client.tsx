"use client";

import { usePlannerPageState } from "./lib/use-planner-page-state";
import { CommitPlanDialog } from "./sections/commit-plan-dialog";
import { PlannerActionsSection } from "./sections/planner-actions-section";
import { PlannerConfigurationSection } from "./sections/planner-configuration-section";
import { PlannerHeaderSection } from "./sections/planner-header-section";
import { PlannerResultsSection } from "./sections/planner-results-section";
import { PlannerStatusAlerts } from "./sections/planner-status-alerts";

export default function PlannerPageClient() {
  const state = usePlannerPageState();

  return (
    <div className="space-y-6 p-6">
      <PlannerHeaderSection
        restoredFromDraft={state.restoredFromDraft}
        onClearPlan={state.handleClearPlan}
      />

      <PlannerConfigurationSection
        json={state.json}
        onJsonChange={state.setJson}
        getCurrentParams={state.getCurrentParams}
        onLoadProfile={state.handleLoadProfile}
        courierMode={state.courierMode}
        setCourierMode={state.setCourierMode}
        capacityDisplay={state.capacityDisplay}
        onCapacityChange={state.handleCapacityChange}
        onCapacityBlur={state.handleCapacityBlur}
        investmentDisplay={state.investmentDisplay}
        onInvestmentChange={state.handleInvestmentChange}
        onInvestmentBlur={state.handleInvestmentBlur}
        maxPackagesDisplay={state.maxPackagesDisplay}
        onMaxPackagesChange={state.handleMaxPackagesChange}
        shareDisplay={state.shareDisplay}
        onShareChange={state.handleShareChange}
        collateralDisplay={state.collateralDisplay}
        onCollateralChange={state.handleCollateralChange}
        onCollateralBlur={state.handleCollateralBlur}
        autoBlockadeMaxVolumeM3={state.autoBlockadeMaxVolumeM3}
        setAutoBlockadeMaxVolumeM3={state.setAutoBlockadeMaxVolumeM3}
        autoBlockadeMaxCollateralISK={state.autoBlockadeMaxCollateralISK}
        setAutoBlockadeMaxCollateralISK={state.setAutoBlockadeMaxCollateralISK}
        autoDstMaxVolumeM3={state.autoDstMaxVolumeM3}
        setAutoDstMaxVolumeM3={state.setAutoDstMaxVolumeM3}
        autoDstMaxCollateralISK={state.autoDstMaxCollateralISK}
        setAutoDstMaxCollateralISK={state.setAutoDstMaxCollateralISK}
        showAdvancedOptions={state.showAdvancedOptions}
        setShowAdvancedOptions={state.setShowAdvancedOptions}
        liquidityWindowDays={state.liquidityWindowDays}
        setLiquidityWindowDays={state.setLiquidityWindowDays}
        liquidityMinCoverageRatio={state.liquidityMinCoverageRatio}
        setLiquidityMinCoverageRatio={state.setLiquidityMinCoverageRatio}
        liquidityMinLiquidityThresholdISK={state.liquidityMinLiquidityThresholdISK}
        setLiquidityMinLiquidityThresholdISK={state.setLiquidityMinLiquidityThresholdISK}
        liquidityMinWindowTrades={state.liquidityMinWindowTrades}
        setLiquidityMinWindowTrades={state.setLiquidityMinWindowTrades}
        arbMaxInventoryDays={state.arbMaxInventoryDays}
        setArbMaxInventoryDays={state.setArbMaxInventoryDays}
        arbMinMarginPercent={state.arbMinMarginPercent}
        setArbMinMarginPercent={state.setArbMinMarginPercent}
        arbMaxPriceDeviationMultiple={state.arbMaxPriceDeviationMultiple}
        setArbMaxPriceDeviationMultiple={state.setArbMaxPriceDeviationMultiple}
        arbMinTotalProfitISK={state.arbMinTotalProfitISK}
        setArbMinTotalProfitISK={state.setArbMinTotalProfitISK}
        arbDisableInventoryLimit={state.arbDisableInventoryLimit}
        setArbDisableInventoryLimit={state.setArbDisableInventoryLimit}
        arbAllowInventoryTopOff={state.arbAllowInventoryTopOff}
        setArbAllowInventoryTopOff={state.setArbAllowInventoryTopOff}
        allocationMode={state.allocationMode}
        setAllocationMode={state.setAllocationMode}
        spreadBias={state.spreadBias}
        setSpreadBias={state.setSpreadBias}
        minPackageNetProfitISK={state.minPackageNetProfitISK}
        setMinPackageNetProfitISK={state.setMinPackageNetProfitISK}
        minPackageROIPercent={state.minPackageROIPercent}
        setMinPackageROIPercent={state.setMinPackageROIPercent}
        shippingMarginMultiplier={state.shippingMarginMultiplier}
        setShippingMarginMultiplier={state.setShippingMarginMultiplier}
        densityWeight={state.densityWeight}
        setDensityWeight={state.setDensityWeight}
      />

      <PlannerActionsSection
        loading={state.loading}
        hasData={!!state.data}
        memo={state.memo}
        setMemo={state.setMemo}
        commitPending={state.commitPending}
        suggestedShipping={state.suggestedShipping}
        suggestedShippingMemo={state.suggestedShippingMemo}
        onGeneratePlan={() => void state.handleSubmit()}
        onOpenCommitDialog={({ recordShipping, shippingAmount, shippingMemo }) => {
          state.setRecordShipping(recordShipping);
          state.setShippingAmount(shippingAmount);
          state.setShippingMemo(shippingMemo);
          state.setCommitDialogOpen(true);
        }}
      />

      <CommitPlanDialog
        open={state.commitDialogOpen}
        setOpen={state.setCommitDialogOpen}
        recordShipping={state.recordShipping}
        setRecordShipping={state.setRecordShipping}
        shippingAmount={state.shippingAmount}
        setShippingAmount={state.setShippingAmount}
        shippingMemo={state.shippingMemo}
        setShippingMemo={state.setShippingMemo}
        suggestedShipping={state.suggestedShipping}
        hasData={!!state.data}
        commitPending={state.commitPending}
        addTransportPending={state.addTransportPending}
        onCommitOnly={() => void state.commitPlan({ recordShipping: false })}
        onCommitWithOptions={() => void state.commitPlan({ recordShipping: state.recordShipping })}
      />

      <PlannerStatusAlerts error={state.error} commitSuccess={state.commitSuccess} />

      {state.data && (
        <PlannerResultsSection
          data={state.data}
          groupedByDest={state.groupedByDest}
          copyTextByPackage={state.copyTextByPackage}
          copiedDest={state.copiedDest}
          onCopyList={(destId, text) => void state.handleCopyList(destId, text)}
        />
      )}
    </div>
  );
}
