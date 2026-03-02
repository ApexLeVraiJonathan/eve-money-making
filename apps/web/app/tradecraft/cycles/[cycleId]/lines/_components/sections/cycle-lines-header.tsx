"use client";

import * as React from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
} from "@eve/ui";
import { ArrowLeft, Plus } from "lucide-react";
import { getCycleShortId } from "../lib/cycle-lines-helpers";

type CycleLinesHeaderProps = {
  cycleId: string;
  showCreateDialog: boolean;
  typeId: string;
  destinationStationId: string;
  plannedUnits: string;
  onBack: () => void;
  onCreateDialogOpenChange: (open: boolean) => void;
  onTypeIdChange: (value: string) => void;
  onDestinationStationIdChange: (value: string) => void;
  onPlannedUnitsChange: (value: string) => void;
  onCreateLine: () => void;
};

export function CycleLinesHeader({
  cycleId,
  showCreateDialog,
  typeId,
  destinationStationId,
  plannedUnits,
  onBack,
  onCreateDialogOpenChange,
  onTypeIdChange,
  onDestinationStationIdChange,
  onPlannedUnitsChange,
  onCreateLine,
}: CycleLinesHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cycle Lines</h1>
          <p className="text-sm text-muted-foreground">
            Buy commits for cycle {getCycleShortId(cycleId)}...
          </p>
        </div>
      </div>
      <Dialog open={showCreateDialog} onOpenChange={onCreateDialogOpenChange}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Line
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Cycle Line</DialogTitle>
            <DialogDescription>
              Add a buy commitment line for a specific item and destination.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="typeId">Type ID</Label>
              <Input
                id="typeId"
                type="number"
                placeholder="e.g. 34"
                value={typeId}
                onChange={(e) => onTypeIdChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="destinationStationId">Destination Station ID</Label>
              <Input
                id="destinationStationId"
                type="number"
                placeholder="e.g. 60011866"
                value={destinationStationId}
                onChange={(e) => onDestinationStationIdChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plannedUnits">Planned Units</Label>
              <Input
                id="plannedUnits"
                type="number"
                placeholder="e.g. 100"
                value={plannedUnits}
                onChange={(e) => onPlannedUnitsChange(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onCreateDialogOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={onCreateLine}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
