"use client";

import * as React from "react";
import { Badge } from "@eve/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@eve/ui/tooltip";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import type { RequirementSummary } from "../lib/types";

export function RequirementBadge({
  label,
  status,
  details,
}: {
  label: string;
  status: RequirementSummary["status"];
  details?: string | null;
}) {
  let variant: "default" | "secondary" | "outline" = "secondary";
  const icons = {
    pass: <CheckCircle2 className="h-3 w-3" />,
    warning: <AlertTriangle className="h-3 w-3" />,
    fail: <XCircle className="h-3 w-3" />,
  };

  if (status === "pass") {
    variant = "default";
  } else if (status === "fail") {
    // Use outline for failures; we rely on text and context, not color only.
    variant = "outline";
  }

  const badge = (
    <Badge
      variant={variant}
      className="flex items-center gap-1"
      data-status={status}
    >
      {icons[status]}
      {label}
    </Badge>
  );

  if (!details) return badge;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent sideOffset={8} className="max-w-xs">
        {details}
      </TooltipContent>
    </Tooltip>
  );
}
