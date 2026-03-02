"use client";

import { History } from "lucide-react";
import {
  Card,
  CardContent,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@eve/ui";

export function CycleHistoryEmptyState() {
  return (
    <Card>
      <CardContent className="pt-6">
        <Empty className="min-h-48">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <History className="size-6" />
            </EmptyMedia>
            <EmptyTitle>No completed cycles yet</EmptyTitle>
            <EmptyDescription>
              Once cycles are completed, their performance history will appear
              here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </CardContent>
    </Card>
  );
}
