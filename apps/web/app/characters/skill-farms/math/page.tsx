"use client";

import { useState } from "react";
import {
  useSkillFarmSettings,
  useUpdateSkillFarmSettings,
  useSkillFarmMathPreview,
} from "../api";
import { Card, CardContent, CardHeader, CardTitle } from "@eve/ui/card";
import { Button } from "@eve/ui/button";
import { Input } from "@eve/ui/input";
import { Label } from "@eve/ui/label";
import { Checkbox } from "@eve/ui/checkbox";

function NumberInput({
  id,
  label,
  value,
  onChange,
  help,
}: {
  id: string;
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  help?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))
        }
      />
      {help && <p className="text-xs text-foreground/70">{help}</p>}
    </div>
  );
}

function MathContent() {
  const { data: settings } = useSkillFarmSettings();
  const updateSettings = useUpdateSkillFarmSettings();
  const {
    mutate: runPreview,
    data: result,
    status,
  } = useSkillFarmMathPreview();

  const [accounts, setAccounts] = useState(1);
  const [farmCharsPerAccount, setFarmCharsPerAccount] = useState(1);
  const [spPerDay, setSpPerDay] = useState(50000);

  const handleRecalculate = () => {
    if (!settings) return;
    runPreview({
      settings,
      accounts,
      farmCharactersPerAccount: farmCharsPerAccount,
      ignoreOmegaCostAccountIndexes: [],
      spPerDayPerCharacter: spPerDay,
    });
  };

  if (!settings) {
    return <p className="text-sm text-foreground/80">Loading settings…</p>;
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1.5fr_1.2fr]">
      <Card className="bg-gradient-to-b from-background to-muted/5">
        <CardHeader>
          <CardTitle className="text-base">Economic assumptions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <NumberInput
            id="plexPriceIsk"
            label="PLEX price (ISK per PLEX)"
            value={settings.plexPriceIsk}
            onChange={(plexPriceIsk) => updateSettings.mutate({ plexPriceIsk })}
            help="Use your effective price, including NES sales or Discord trades."
          />
          <NumberInput
            id="plexPerOmega"
            label="PLEX per Omega"
            value={settings.plexPerOmega}
            onChange={(plexPerOmega) =>
              updateSettings.mutate({ plexPerOmega: plexPerOmega ?? null })
            }
            help="Effective PLEX per 30 days of Omega (after discounts)."
          />
          <NumberInput
            id="plexPerMct"
            label="PLEX per MCT"
            value={settings.plexPerMct}
            onChange={(plexPerMct) =>
              updateSettings.mutate({ plexPerMct: plexPerMct ?? null })
            }
          />
          <NumberInput
            id="extractorPriceIsk"
            label="Extractor cost (ISK each)"
            value={settings.extractorPriceIsk}
            onChange={(extractorPriceIsk) =>
              updateSettings.mutate({ extractorPriceIsk })
            }
          />
          <NumberInput
            id="injectorPriceIsk"
            label="Injector sell price (ISK)"
            value={settings.injectorPriceIsk}
            onChange={(injectorPriceIsk) =>
              updateSettings.mutate({ injectorPriceIsk })
            }
          />
          <NumberInput
            id="boosterCostPerCycleIsk"
            label="Booster cost per cycle (ISK)"
            value={settings.boosterCostPerCycleIsk}
            onChange={(boosterCostPerCycleIsk) =>
              updateSettings.mutate({ boosterCostPerCycleIsk })
            }
          />
          <NumberInput
            id="salesTaxPercent"
            label="Sales tax (%)"
            value={settings.salesTaxPercent}
            onChange={(salesTaxPercent) =>
              updateSettings.mutate({ salesTaxPercent })
            }
          />
          <NumberInput
            id="brokerFeePercent"
            label="Broker fee (%)"
            value={settings.brokerFeePercent}
            onChange={(brokerFeePercent) =>
              updateSettings.mutate({ brokerFeePercent })
            }
          />
          <NumberInput
            id="cycleDays"
            label="Cycle length (days)"
            value={settings.cycleDays}
            onChange={(cycleDays) => updateSettings.mutate({ cycleDays })}
            help="Length of one farm cycle, e.g. 30 days."
          />
          <NumberInput
            id="managementMinutesPerCycle"
            label="Your time per cycle (minutes)"
            value={settings.managementMinutesPerCycle}
            onChange={(managementMinutesPerCycle) =>
              updateSettings.mutate({ managementMinutesPerCycle })
            }
            help="Rough time spent managing the farm per cycle."
          />
          <div className="col-span-2 flex items-center space-x-2 pt-1">
            <Checkbox
              id="soldViaContracts"
              checked={!!settings.soldViaContracts}
              onCheckedChange={(checked) =>
                updateSettings.mutate({ soldViaContracts: !!checked })
              }
            />
            <Label htmlFor="soldViaContracts" className="text-xs font-normal">
              Sold via contracts / direct trades (skip market tax & broker fees)
            </Label>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-b from-background to-muted/5">
        <CardHeader>
          <CardTitle className="text-base">Farm shape</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-foreground/80">
          <div className="grid gap-3 md:grid-cols-2">
            <NumberInput
              id="accounts"
              label="# of accounts"
              value={accounts}
              onChange={(v) => setAccounts(v ?? 0)}
            />
            <NumberInput
              id="charsPerAccount"
              label="Farm characters per account"
              value={farmCharsPerAccount}
              onChange={(v) => setFarmCharsPerAccount(v ?? 0)}
            />
            <NumberInput
              id="spPerDay"
              label="SP per day per character"
              value={spPerDay}
              onChange={(v) => setSpPerDay(v ?? 0)}
              help="Approximate SP/day with your attributes, +5s, and boosters."
            />
          </div>
          <Button onClick={handleRecalculate} disabled={status === "pending"}>
            {status === "pending" ? "Calculating…" : "Recalculate"}
          </Button>

          {result && (
            <div className="space-y-2 pt-3">
              <p className="font-medium">Per character (per cycle)</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  SP per cycle:{" "}
                  {Math.round(result.perCharacter.spPerCycle).toLocaleString()}{" "}
                  SP
                </li>
                <li>
                  Injectors per cycle:{" "}
                  {result.perCharacter.injectorsPerCycle.toFixed(2)}
                </li>
                <li>
                  Net profit:{" "}
                  {Math.round(
                    result.perCharacter.netProfitIsk,
                  ).toLocaleString()}{" "}
                  ISK
                </li>
              </ul>
              <p className="font-medium pt-2">Total farm</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  Characters: {accounts * farmCharsPerAccount} (across{" "}
                  {accounts} accounts)
                </li>
                <li>
                  Total net profit per cycle:{" "}
                  {Math.round(result.total.netProfitIsk).toLocaleString()} ISK
                </li>
                <li>
                  ISK/hour of your time: {result.iskPerHour.toFixed(0)} ISK/h
                </li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function SkillFarmMathPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Skill farm math &amp; planner
        </h1>
        <p className="max-w-3xl text-sm text-foreground/80">
          Configure your own PLEX prices, extractor/injector costs, and farm
          layout to estimate profit per character, per account, and for your
          whole farm.
        </p>
      </header>
      <MathContent />
    </div>
  );
}
