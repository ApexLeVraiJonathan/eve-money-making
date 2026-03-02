import { toast } from "@eve/ui";
import type { Cycle } from "@eve/shared/tradecraft-cycles";
import { normalizeIsk } from "./cycle-utils";

type CycleUpdatePayload = {
  name?: string;
  startedAt?: string;
  initialInjectionIsk?: string;
};

type BuildCycleUpdatePayloadParams = {
  cycle: Cycle;
  editName: string;
  editStartedAt: string;
  editInitialInjection: string;
};

type RunToastActionOptions = {
  action: () => Promise<unknown>;
  successMessage: string;
  onSuccess?: () => void;
  errorMessage?: string | ((error: unknown) => string);
};

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function resolvePlanStartDate(planStart: string): Date | null {
  if (planStart.trim() === "") {
    return new Date(Date.now() + 24 * 60 * 60 * 1000);
  }

  const date = new Date(planStart);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export function buildCycleUpdatePayload({
  cycle,
  editName,
  editStartedAt,
  editInitialInjection,
}: BuildCycleUpdatePayloadParams): CycleUpdatePayload {
  const payload: CycleUpdatePayload = {};
  const trimmedName = editName.trim();

  if (trimmedName) {
    payload.name = trimmedName;
  } else if (cycle.name) {
    payload.name = cycle.name ?? undefined;
  }

  if (cycle.status === "PLANNED") {
    const startedAt = new Date(editStartedAt);
    if (!Number.isNaN(startedAt.getTime())) {
      payload.startedAt = startedAt.toISOString();
    }

    const normalizedInjection = normalizeIsk(editInitialInjection);
    if (typeof normalizedInjection !== "undefined") {
      payload.initialInjectionIsk = normalizedInjection;
    }
  }

  return payload;
}

export async function runToastAction({
  action,
  successMessage,
  onSuccess,
  errorMessage,
}: RunToastActionOptions): Promise<boolean> {
  try {
    await action();
    onSuccess?.();
    toast.success(successMessage);
    return true;
  } catch (error) {
    const message =
      typeof errorMessage === "function"
        ? errorMessage(error)
        : errorMessage ?? getErrorMessage(error);
    toast.error(message);
    return false;
  }
}
