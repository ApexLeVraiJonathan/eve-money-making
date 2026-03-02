"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@eve/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@eve/ui/empty";
import { Users } from "lucide-react";

export function CharactersEmptyState() {
  return (
    <Empty className="bg-gradient-to-b from-background to-muted/10">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Users />
        </EmptyMedia>
        <EmptyTitle>No characters to evaluate yet</EmptyTitle>
        <EmptyDescription>
          Link your characters first, then return here to check skill-farm
          readiness and activate farms for Tracking.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild>
          <Link href="/characters">Go to Characters</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
