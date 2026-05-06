import type {
  CycleSettlementReport,
  CycleSettlementStepKind,
  CycleSettlementStepName,
  CycleSettlementStepReport,
} from '@eve/shared/tradecraft-cycles' assert { 'resolution-mode': 'import' };

export type CycleSettlementRecorder = (
  name: CycleSettlementStepName,
  kind: CycleSettlementStepKind,
  status: CycleSettlementStepReport['status'],
  startedAt: number,
  message?: string,
) => void;

export class CycleSettlementReportBuilder {
  private readonly settlementSteps: CycleSettlementStepReport[] = [];

  constructor(
    private readonly input: {
      settledCycleId: string | null;
      targetCycleId: string | null;
    },
  ) {}

  readonly recordStep: CycleSettlementRecorder = (
    name,
    kind,
    status,
    startedAt,
    message,
  ) => {
    this.settlementSteps.push({
      name,
      kind,
      status,
      durationMs: Date.now() - startedAt,
      ...(message ? { message } : {}),
    });
  };

  build(): CycleSettlementReport {
    return {
      settledCycleId: this.input.settledCycleId,
      targetCycleId: this.input.targetCycleId,
      steps: this.settlementSteps,
      recoverableFailures: this.settlementSteps.filter(
        (step) => step.kind === 'recoverable' && step.status === 'failed',
      ),
    };
  }
}
