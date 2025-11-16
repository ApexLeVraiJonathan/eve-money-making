"use client";

import * as React from "react";
import { Info } from "lucide-react";
import { Label } from "./label";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

export interface LabeledInputProps {
  /**
   * The label text to display
   */
  label: string;
  /**
   * Tooltip text to show when hovering over the info icon
   */
  tooltip: string;
  /**
   * Optional HTML `for` attribute to associate label with input
   */
  htmlFor?: string;
  /**
   * The input element(s) to render below the label
   */
  children: React.ReactNode;
  /**
   * Additional CSS classes for the container
   */
  className?: string;
}

/**
 * A labeled input wrapper component with an optional tooltip
 * 
 * This component provides a consistent way to display form inputs with:
 * - A descriptive label
 * - An info icon that shows a tooltip on hover
 * - Proper spacing and layout
 * 
 * @example
 * ```tsx
 * <LabeledInput
 *   label="Time Window (days)"
 *   tooltip="Number of days to look back when calculating averages"
 *   htmlFor="window-days"
 * >
 *   <Input
 *     id="window-days"
 *     type="number"
 *     value={windowDays}
 *     onChange={(e) => setWindowDays(Number(e.target.value))}
 *   />
 * </LabeledInput>
 * ```
 */
export function LabeledInput({
  label,
  tooltip,
  htmlFor,
  children,
  className,
}: LabeledInputProps) {
  return (
    <div className={className ? `space-y-2 ${className}` : "space-y-2"}>
      <div className="flex items-center gap-2">
        <Label htmlFor={htmlFor}>{label}</Label>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs">
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </div>
      {children}
    </div>
  );
}

