import type { SkillFarmTrackingEntry } from "@eve/shared/skill-contracts";
import { Card, CardContent, CardHeader, CardTitle } from "@eve/ui/card";
import { Badge } from "@eve/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@eve/ui/select";
import { formatTrainingTime } from "../../../../skills/plans/utils/trainingTime";
import { formatIsoOrDash } from "../lib/formatting";

type SkillPlanOption = {
  id: string;
  name: string;
};

type TrackingCharacterCardProps = {
  character: SkillFarmTrackingEntry;
  plans: SkillPlanOption[];
  onFarmPlanChange: (characterId: number, farmPlanId: string | null) => Promise<void>;
};

function StatusBadge({
  status,
}: {
  status: "OK" | "WARNING" | "URGENT" | "EMPTY";
}) {
  if (status === "OK") return <Badge variant="secondary">OK</Badge>;
  if (status === "WARNING") return <Badge>Queue &lt;= 3 days</Badge>;
  if (status === "URGENT") return <Badge variant="outline">Queue &lt;= 1 day</Badge>;
  return <Badge variant="outline">Queue empty</Badge>;
}

function TargetSourceBadge({
  source,
}: {
  source: "ALL_ABOVE_FLOOR" | "SETTINGS" | "PLAN";
}) {
  if (source === "PLAN") return <Badge>Plan</Badge>;
  if (source === "SETTINGS") return <Badge variant="secondary">Targets</Badge>;
  return <Badge variant="outline">All above floor</Badge>;
}

export function TrackingCharacterCard({
  character,
  plans,
  onFarmPlanChange,
}: TrackingCharacterCardProps) {
  const hasActiveSkill = !!character.activeTrainingSkillId;
  const queueRemainingLabel =
    character.queueSecondsRemaining > 0
      ? formatTrainingTime(Math.round(character.queueSecondsRemaining))
      : "none (empty)";

  return (
    <Card className="bg-gradient-to-b from-background to-muted/5">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="space-y-1">
          <CardTitle className="text-base">{character.name}</CardTitle>
          <p className="text-xs text-foreground/80">
            Total SP: {character.totalSp.toLocaleString()} - floor:{" "}
            {character.nonExtractableSp.toLocaleString()} SP
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <TargetSourceBadge source={character.targetSource} />
          <StatusBadge status={character.queueStatus} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-xs text-foreground/80">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-md border bg-background/50 p-3">
            <div className="text-[11px] text-foreground/70">
              Farmable SP (per targets)
            </div>
            <div className="mt-1 text-sm font-medium text-foreground">
              {character.farmPlanSp.toLocaleString()} SP
            </div>
          </div>
          <div className="rounded-md border bg-background/50 p-3">
            <div className="text-[11px] text-foreground/70">Extractable now</div>
            <div className="mt-1 text-sm font-medium text-foreground">
              {character.extractableSp.toLocaleString()} SP
            </div>
            <div className="mt-1 text-[11px] text-foreground/70">
              {character.fullExtractorsReady} LSI ready -{" "}
              {character.remainderSp.toLocaleString()} SP toward next
            </div>
          </div>
        </div>

        <p>
          Training queue remaining:{" "}
          <span className="font-medium">{queueRemainingLabel}</span>
        </p>
        <p>
          Active skill:{" "}
          {hasActiveSkill ? (
            <span className="font-medium">
              {character.activeTrainingSkillName ??
                `Skill ${character.activeTrainingSkillId}`}
            </span>
          ) : (
            <span className="font-medium">—</span>
          )}{" "}
          <span className="text-foreground/70">
            (ends {formatIsoOrDash(character.activeTrainingEndsAt)})
          </span>
        </p>

        <div className="rounded-md border bg-background/50 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <div className="text-xs font-medium text-foreground">
                Farm plan (optional)
              </div>
              <div className="text-[11px] text-foreground/70">
                When set, plan steps define farmable SP for this character.
              </div>
            </div>
            <div className="w-full sm:w-[260px]">
              <Select
                value={character.farmPlanId ?? "none"}
                onValueChange={(value) =>
                  void onFarmPlanChange(
                    character.characterId,
                    value === "none" ? null : value,
                  )
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="none">No plan (use targets)</SelectItem>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
