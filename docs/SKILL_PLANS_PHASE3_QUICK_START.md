# Phase 3 Implementation Quick Start Guide

## Session Startup Checklist

### 1. Review Context
- [ ] Read `docs/SKILL_PLANS_PHASE3_SPECIFICATION.md` (main spec)
- [ ] Review current code: `apps/web/app/characters/skills/plans/page.tsx`
- [ ] Check completed Phase 1 & 2 improvements (category grouping, tooltips, layout)

### 2. Component Already Created
- ✅ `apps/web/app/characters/skills/plans/components/ImportDialog.tsx` - Ready to integrate

### 3. Implementation Order (Follow This Sequence)

#### **Step 1: Header Restructuring (30-45 min)**
File: `apps/web/app/characters/skills/plans/page.tsx`

Replace the `<CardHeader>` section in `SkillPlanDetailView` with:
```tsx
<div className="grid gap-4 lg:grid-cols-[2fr_3fr] mb-4">
  {/* Card 1: Plan Info */}
  <Card>
    <CardHeader>
      <CardTitle className="text-sm">Plan Information</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-medium">Plan Name</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      
      <div className="space-y-2">
        <label className="text-xs font-medium">Assigned Character</label>
        <div className="flex gap-2">
          <Select value={selectedCharacterId ? String(selectedCharacterId) : ""} 
                  onValueChange={(v) => setSelectedCharacterId(Number(v))}>
            <SelectTrigger><SelectValue placeholder="Pick character (optional)" /></SelectTrigger>
            <SelectContent>
              {characters.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" disabled={!selectedCharacterId} onClick={handleAssign}>Assign</Button>
          <Button size="sm" variant="ghost" disabled={!selectedCharacterId} onClick={handleUnassign}>Unassign</Button>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-3 pt-4 border-t text-xs">
        <div><span className="text-muted-foreground">Created</span><br/><span className="font-medium">{new Date(plan.createdAt).toLocaleDateString()}</span></div>
        <div><span className="text-muted-foreground">Updated</span><br/><span className="font-medium">{new Date(plan.updatedAt).toLocaleDateString()}</span></div>
        <div><span className="text-muted-foreground">Steps</span><br/><span className="font-medium">{plan.steps.length}</span></div>
      </div>
    </CardContent>
  </Card>

  {/* Card 2: Description & Actions */}
  <Card>
    <CardHeader>
      <CardTitle className="text-sm">Description & Actions</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-medium">Description</label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      </div>
      
      <div className="flex items-center justify-end gap-2">
        {/* Import/Export Dropdown - Step 2 */}
        {/* Optimize Button */}
        {/* Save Button */}
      </div>
    </CardContent>
  </Card>
</div>
```

#### **Step 2: Import/Export Dropdown (30 min)**
Add state and dropdown to Card 2:
```tsx
const [importDialogOpen, setImportDialogOpen] = useState(false);

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline" size="sm">
      <FileText className="mr-2 h-4 w-4" />
      Import/Export
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuLabel>Import</DropdownMenuLabel>
    <DropdownMenuItem onClick={() => setImportDialogOpen(true)}>
      <Upload className="mr-2 h-4 w-4" />
      From EVE Online...
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuLabel>Export</DropdownMenuLabel>
    <DropdownMenuItem onClick={handleExport} disabled={plan.steps.length === 0}>
      <Download className="mr-2 h-4 w-4" />
      As EVE Text
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>

<ImportDialog 
  open={importDialogOpen}
  onOpenChange={setImportDialogOpen}
  onImport={handleImportFromDialog}
  isLoading={importIntoPlan.isPending}
/>
```

Update import handler:
```tsx
const handleImportFromDialog = async (text: string, replace: boolean) => {
  if (!planId) return;
  try {
    if (replace) {
      const result = await importIntoPlan.mutateAsync({ text, format: "eve" });
      setStepsDraft(result.steps.map((s, idx) => ({
        id: s.id,
        skillId: s.skillId,
        targetLevel: s.targetLevel,
        order: s.order ?? idx,
        notes: s.notes ?? "",
      })));
      toast.success("Plan replaced from imported text");
    } else {
      const result = await importPreview.mutateAsync({ text, format: "eve" });
      setStepsDraft(result.plan.steps.map((s, idx) => ({
        id: s.id,
        skillId: s.skillId,
        targetLevel: s.targetLevel,
        order: s.order ?? idx,
        notes: s.notes ?? "",
      })));
      toast.success("Import preview loaded");
    }
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
  }
};
```

#### **Step 3: Training Time Utilities (45 min)**
Create file: `apps/web/app/characters/skills/plans/utils/trainingTime.ts`
```tsx
export function calculateTrainingTime(
  skillRank: number,
  targetLevel: number,
  primaryAttr: number = 20,
  secondaryAttr: number = 20
): number {
  const spRequired = Math.pow(2, targetLevel - 1) * 250 * skillRank;
  const trainRate = primaryAttr + secondaryAttr / 2;
  return Math.ceil(spRequired / trainRate * 60); // seconds
}

export function formatTrainingTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
}

export const romanNumerals: Record<number, string> = {
  1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V',
};
```

#### **Step 4: Prerequisite Utilities (1 hour)**
Create file: `apps/web/app/characters/skills/plans/utils/prerequisites.ts`

Copy the `enhanceStepsWithPrerequisites` function from the spec.

#### **Step 5: Enhanced Table UI (1.5 hours)**
Update the plan steps table section in `page.tsx` to use the new format from the spec (Section 3).

Key changes:
- Add Level column (Roman numerals)
- Add Time column
- Add Total Time footer
- Update step rendering logic
- Add prerequisite indicators

#### **Step 6: Level Selector on Add (1 hour)**
Update `SkillAddButton` component to show inline level selector (Option A from spec).

Modify `handleAddSkillToPlan` signature:
```tsx
const handleAddSkillToPlan = (skillId: number, level: number = 1) => {
  // existing logic but use `level` parameter
};
```

#### **Step 7: Prerequisite Tree (1.5 hours)**
Create file: `apps/web/app/characters/skills/plans/components/PrerequisiteTree.tsx`

Copy implementation from spec Section 5.

Add expand/collapse state management to main component.

#### **Step 8: Movement Constraints (1 hour)**
Create file: `apps/web/app/characters/skills/plans/utils/constraints.ts`

Implement `canMoveStep` function from spec Section 6.

Update `moveStep` handler to validate before moving.

#### **Step 9: Testing (1 hour)**
Use browser tools to test all scenarios from Section 10 of spec.

---

## Quick Reference: Key Functions to Update

### In `page.tsx`:

1. **handleAddSkillToPlan** - Add `level` parameter
2. **moveStep** - Add constraint validation
3. **removeStep** - Add prerequisite check
4. **stepsDraft state** - Enhance with training time data
5. **Render logic** - Use enhanced steps in table

### New State Variables Needed:
```tsx
const [importDialogOpen, setImportDialogOpen] = useState(false);
const [expandedPrerequisites, setExpandedPrerequisites] = useState<Set<number>>(new Set());
```

### New Computed Values:
```tsx
const enhancedSteps = useMemo(() => 
  enhanceStepsWithPrerequisites(stepsDraft, encyclopedia),
  [stepsDraft, encyclopedia]
);

const totalTrainingTime = useMemo(() =>
  enhancedSteps.reduce((sum, s) => sum + s.trainingTimeSeconds, 0),
  [enhancedSteps]
);
```

---

## Troubleshooting Common Issues

### "Training time shows 0 or NaN"
- Check if skill rank/trainingMultiplier is present in encyclopedia data
- Verify skill exists in encyclopedia
- Ensure attributes are numbers, not undefined

### "Prerequisites not detected"
- Verify encyclopedia.skills includes `prerequisites` array
- Check that prerequisite skillId exists in plan
- Ensure targetLevel >= requiredLevel

### "Can't move any skills"
- Check constraint logic isn't too restrictive
- Verify canMoveUp/canMoveDown are being set correctly
- Log constraint validation results for debugging

### "Import dialog doesn't work"
- Ensure Dialog component imports are correct
- Check onImport handler is async and handles errors
- Verify importIntoPlan API hook is available

---

## Code Quality Checklist

Before marking Phase 3 complete:
- [ ] All TypeScript types defined
- [ ] No `any` types used
- [ ] Error boundaries around complex logic
- [ ] Loading states for all async operations
- [ ] Toasts for all user actions
- [ ] Console.log statements removed
- [ ] Comments for complex logic
- [ ] Consistent naming conventions
- [ ] No linting errors
- [ ] No console errors in browser

---

**END OF SPECIFICATION**

Ready to implement in fresh session! 🚀

