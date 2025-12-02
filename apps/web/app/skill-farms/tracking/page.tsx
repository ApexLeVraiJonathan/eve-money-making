export const dynamic = "force-dynamic";

import { Metadata } from "next";
import { useSkillFarmTracking } from "../api";
import { Card, CardContent, CardHeader, CardTitle } from "@eve/ui/card";
import { Badge } from "@eve/ui/badge";

export const metadata: Metadata = {
  title: "Skill Farm – Tracking",
};

function StatusBadge({
  status,
}: {
  status: "OK" | "WARNING" | "URGENT" | "EMPTY";
}) {
  if (status === "OK") return <Badge variant="secondary">OK</Badge>;
  if (status === "WARNING") return <Badge>Queue &lt;= 3 days</Badge>;
  if (status === "URGENT")
    return <Badge variant="outline">Queue &lt;= 1 day</Badge>;
  return <Badge variant="outline">Queue empty</Badge>;
}

function TrackingContent() {
  const { data, isLoading } = useSkillFarmTracking();

  if (isLoading) {
    return <p className="text-sm text-foreground/80">Loading tracking data…</p>;
  }

  if (!data || !data.characters.length) {
    return (
      <p className="text-sm text-foreground/80">
        No active farm characters configured yet. Mark characters as active on
        the Skill Farm Characters page.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {data.characters.map((c) => {
        const hoursRemaining = c.queueSecondsRemaining / 3600;

        return (
          <Card
            key={c.characterId}
            className="bg-gradient-to-b from-background to-muted/5"
          >
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div className="space-y-1">
                <CardTitle className="text-base">{c.name}</CardTitle>
                <p className="text-xs text-foreground/70">
                  Total SP: {c.totalSp.toLocaleString()} – floor:{" "}
                  {c.nonExtractableSp.toLocaleString()} SP
                </p>
              </div>
              <StatusBadge status={c.queueStatus} />
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-foreground/80">
              <p>
                Extractable SP:{" "}
                <span className="font-medium">
                  {c.extractableSp.toLocaleString()} SP
                </span>{" "}
                ({c.fullExtractorsReady} full extractor
                {c.fullExtractorsReady === 1 ? "" : "s"} ready)
              </p>
              {c.etaToNextExtractorSeconds != null &&
                c.etaToNextExtractorSeconds > 0 && (
                  <p>
                    Next extractor in about{" "}
                    {Math.round(c.etaToNextExtractorSeconds / 3600)} hours.
                  </p>
                )}
              <p>
                Queue time remaining:{" "}
                {hoursRemaining > 0
                  ? `${Math.round(hoursRemaining)} hours`
                  : "none (empty)"}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function SkillFarmTrackingPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Skill farm tracking
        </h1>
        <p className="max-w-3xl text-sm text-foreground/80">
          See extractable SP and queue risk for all active farm characters.
          Discord alerts will fire when extractors are ready or queues go low or
          empty.
        </p>
      </header>
      <TrackingContent />
    </div>
  );
}
