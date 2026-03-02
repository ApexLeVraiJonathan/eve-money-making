import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@eve/ui";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@eve/ui";

export function EmptyAnalysisState() {
  return (
    <Card className="border bg-card">
      <CardContent className="pt-6">
        <Empty className="border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Sparkles />
            </EmptyMedia>
            <EmptyTitle>Run an analysis</EmptyTitle>
            <EmptyDescription>
              Choose a character and import an EFT fit. We&apos;ll surface
              missing requirements and, most importantly, the skills that
              influence the fit&apos;s attributes.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </CardContent>
    </Card>
  );
}
