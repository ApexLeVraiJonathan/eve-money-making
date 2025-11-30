# Skill Plans Page - Phase 3 Implementation Specification

**Date**: November 30, 2025  
**Status**: Ready for Implementation  
**Estimated Effort**: 6-8 hours of focused development

---

## Executive Summary

This specification documents the Phase 3 improvements to the Skill Plans page based on user feedback. The goal is to transform the current functional interface into a production-ready, user-friendly experience that matches (and improves upon) the EVE Online in-game skill planning interface.

### Key Objectives
1. Optimize header space utilization with 2-card layout
2. Replace inline import with space-efficient dialog
3. Create unified Import/Export dropdown menu
4. Enhance plan steps to show detailed training information
5. Add granular skill level control (I, II, III, IV, V)
6. Implement intelligent prerequisite detection and display
7. Add collapsible prerequisite trees
8. Enforce prerequisite ordering constraints

---

## 1. Header Restructuring (2-Card Layout)

### Current State
- Single card header with metadata cramped on left, actions on right
- Wastes horizontal space
- Plan Name and Character Assignment buried in form below

### Target State
Split into two cards side-by-side:

#### Card 1: Plan Information (40% width)
```
┌─────────────────────────────┐
│ Plan Name                   │
│ [Text Input Field]          │
│                             │
│ Assigned Character          │
│ [Dropdown] [Assign] [Unass] │
│                             │
│ Metadata:                   │
│ Created: 11/29/2025         │
│ Updated: 11/29/2025         │
│ Steps: 0                    │
└─────────────────────────────┘
```

#### Card 2: Actions & Description (60% width)
```
┌───────────────────────────────────┐
│ Description                       │
│ [Textarea - 3 rows]              │
│                                   │
│ [Import/Export ▼] [Optimize] [Save] │
└───────────────────────────────────┘
```

### Implementation Details

**Component Structure:**
```tsx
<div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
  {/* Card 1: Plan Info */}
  <Card>
    <CardHeader>
      <CardTitle>Plan Information</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      {/* Plan Name Input */}
      {/* Character Assignment */}
      {/* Metadata Grid */}
    </CardContent>
  </Card>

  {/* Card 2: Actions */}
  <Card>
    <CardHeader>
      <CardTitle>Description & Actions</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      {/* Description Textarea */}
      {/* Action Buttons */}
    </CardContent>
  </Card>
</div>
```

**Benefits:**
- ✅ Better space utilization (removes ~100px of wasted vertical space)
- ✅ Clear visual separation of concerns
- ✅ Plan Name and Character Assignment immediately visible
- ✅ More room for Plan Steps and Skill Browser below

---

## 2. Import/Export Dropdown Menu

### Current State
- "Copy EVE Text" button (unclear naming)
- Inline "Import from EVE" section (takes 150px+ vertical space)
- Separate Optimize button

### Target State
Unified dropdown menu for all import/export operations:

```
┌─────────────────────┐
│ Import/Export ▼     │ ← Single button with dropdown
└─────────────────────┘
```

**Dropdown Menu Options:**
```
Import/Export
├─ Import from EVE...        (Opens Dialog)
├─ Import from File...       (Future: .json, .xml)
├─ ─────────────────
├─ Export as EVE Text        (Copies to clipboard)
├─ Export as JSON            (Future: Download .json)
└─ Export to Game            (Future: One-click to EVE)
```

### Implementation

**Component Code:**
```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline" size="sm" disabled={isSaving}>
      <FileText className="mr-2 h-4 w-4" />
      Import/Export
      <ChevronDown className="ml-2 h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" className="w-48">
    <DropdownMenuLabel>Import</DropdownMenuLabel>
    <DropdownMenuItem onClick={() => setImportDialogOpen(true)}>
      <Upload className="mr-2 h-4 w-4" />
      From EVE Online...
    </DropdownMenuItem>
    <DropdownMenuItem disabled>
      <Upload className="mr-2 h-4 w-4" />
      From File...
    </DropdownMenuItem>
    
    <DropdownMenuSeparator />
    
    <DropdownMenuLabel>Export</DropdownMenuLabel>
    <DropdownMenuItem 
      onClick={handleExportEVE}
      disabled={plan.steps.length === 0}
    >
      <Download className="mr-2 h-4 w-4" />
      As EVE Text
    </DropdownMenuItem>
    <DropdownMenuItem disabled>
      <Download className="mr-2 h-4 w-4" />
      As JSON File
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**Dialog Integration:**
```tsx
const [importDialogOpen, setImportDialogOpen] = useState(false);

<ImportDialog
  open={importDialogOpen}
  onOpenChange={setImportDialogOpen}
  onImport={handleImport}
  isLoading={importPreview.isPending || importIntoPlan.isPending}
/>
```

**Benefits:**
- ✅ Clear, self-explanatory labeling
- ✅ Saves ~150px vertical space (removing inline import section)
- ✅ Extensible for future formats (JSON, XML, direct EVE integration)
- ✅ Consistent with modern app patterns

---

## 3. Enhanced Plan Steps Display

### Current State
```
# | Skill          | Level  | Actions
1 | Gunnery        | [V ▼] | [×]
```

### Target State (Inspired by EVE In-Game)
```
# | Skill                    | Level | Time    | Actions
─────────────────────────────────────────────────────────
1 | Spaceship Command I      | I     | 7m      | [↑][↓][×]
2 | Spaceship Command II     | II    | 30m     | [↑][↓][×]
3 | ⤷ Prerequisite Skill     | III   | 2h      | [−][−][×]
4 | EDENCOM Frigate I        | I     | 13m     | [↑][↓][×]
    └─ (Click to expand prerequisites)
```

### Data Structure Changes

**Enhanced Step Type:**
```typescript
interface EnhancedPlanStep {
  id?: string;
  skillId: number;
  skillName: string;
  targetLevel: number;
  notes?: string;
  
  // NEW: Training time calculation
  trainingTimeSeconds: number;
  
  // NEW: Prerequisite tracking
  isPrerequisite: boolean;
  prerequisiteFor: number[]; // Array of skill IDs this is prereq for
  hasPrerequisites: boolean;
  prerequisitesExpanded?: boolean;
  
  // NEW: Display metadata
  isNew?: boolean; // For animation
  canMoveUp: boolean;
  canMoveDown: boolean;
  canRemove: boolean;
}
```

### Training Time Calculation

**Logic:**
```typescript
// Training time formula from EVE:
// Time (minutes) = (2^(level-1)) * rank * 250 / (primaryAttr + secondaryAttr/2)

function calculateTrainingTime(
  skillId: number,
  targetLevel: number,
  encyclopedia: SkillEncyclopedia,
  characterAttributes?: {
    intelligence: number;
    perception: number;
    charisma: number;
    willpower: number;
    memory: number;
  }
): number {
  const skill = encyclopedia.skills.find(s => s.skillId === skillId);
  if (!skill) return 0;
  
  const rank = skill.rank || skill.trainingMultiplier || 1;
  
  // Default attributes if character not selected
  const attrs = characterAttributes || {
    intelligence: 20,
    perception: 20,
    charisma: 20,
    willpower: 20,
    memory: 20,
  };
  
  // Get primary/secondary attributes for this skill
  const primary = attrs[skill.primaryAttribute.toLowerCase()];
  const secondary = attrs[skill.secondaryAttribute.toLowerCase()];
  
  // Calculate SP required for this level
  const spRequired = Math.pow(2, targetLevel - 1) * 250 * rank;
  
  // Calculate training time in seconds
  const timeSeconds = spRequired / (primary + secondary / 2) * 60;
  
  return timeSeconds;
}

// Format for display
function formatTrainingTime(seconds: number): string {
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
```

### Prerequisite Detection & Display

**Algorithm:**
```typescript
function enhanceStepsWithPrerequisites(
  steps: PlanStep[],
  encyclopedia: SkillEncyclopedia
): EnhancedPlanStep[] {
  const stepMap = new Map<number, EnhancedPlanStep>();
  const prerequisiteMap = new Map<number, Set<number>>(); // skillId -> Set of skillIds it's prereq for
  
  // Step 1: Create enhanced steps
  for (const step of steps) {
    const skillData = encyclopedia.skills.find(s => s.skillId === step.skillId);
    
    stepMap.set(step.skillId, {
      ...step,
      skillName: skillData?.name || `Skill ${step.skillId}`,
      trainingTimeSeconds: calculateTrainingTime(
        step.skillId,
        step.targetLevel,
        encyclopedia
      ),
      isPrerequisite: false,
      prerequisiteFor: [],
      hasPrerequisites: (skillData?.prerequisites || []).length > 0,
      prerequisitesExpanded: false,
      canMoveUp: true,
      canMoveDown: true,
      canRemove: true,
    });
  }
  
  // Step 2: Identify prerequisites
  for (const step of steps) {
    const skillData = encyclopedia.skills.find(s => s.skillId === step.skillId);
    if (!skillData) continue;
    
    for (const prereq of skillData.prerequisites) {
      const prereqStep = stepMap.get(prereq.skillId);
      if (prereqStep && prereqStep.targetLevel >= prereq.requiredLevel) {
        // This skill in plan is a prerequisite for current skill
        prereqStep.isPrerequisite = true;
        prereqStep.prerequisiteFor.push(step.skillId);
        
        if (!prerequisiteMap.has(prereq.skillId)) {
          prerequisiteMap.set(prereq.skillId, new Set());
        }
        prerequisiteMap.get(prereq.skillId)!.add(step.skillId);
      }
    }
  }
  
  // Step 3: Set movement constraints
  const enhancedSteps = Array.from(stepMap.values());
  for (let i = 0; i < enhancedSteps.length; i++) {
    const step = enhancedSteps[i];
    
    // Can't move up if first item
    step.canMoveUp = i > 0;
    
    // Can't move down if last item
    step.canMoveDown = i < enhancedSteps.length - 1;
    
    // Can't remove if it's a prerequisite for skills after it
    if (step.isPrerequisite) {
      const dependentSkills = prerequisiteMap.get(step.skillId);
      if (dependentSkills) {
        // Check if any dependent skills are after this one
        const currentIndex = i;
        const hasDependentsAfter = enhancedSteps.some((s, idx) => 
          idx > currentIndex && dependentSkills.has(s.skillId)
        );
        step.canRemove = !hasDependentsAfter;
        
        // Can't move down past dependent skills
        if (hasDependentsAfter) {
          const lastDependentIndex = enhancedSteps.findLastIndex(s => 
            dependentSkills.has(s.skillId)
          );
          step.canMoveDown = false; // Simplified: don't allow moving prerequisites
        }
      }
    }
  }
  
  return enhancedSteps;
}
```

### UI Component for Enhanced Steps

```tsx
<table className="w-full text-xs">
  <thead className="bg-muted sticky top-0">
    <tr>
      <th className="px-2 py-1.5 w-10">#</th>
      <th className="px-2 py-1.5 text-left">Skill</th>
      <th className="px-2 py-1.5 w-16 text-center">Level</th>
      <th className="px-2 py-1.5 w-24 text-right">Time</th>
      <th className="px-2 py-1.5 w-24 text-right">Actions</th>
    </tr>
  </thead>
  <tbody>
    {enhancedSteps.map((step, idx) => (
      <React.Fragment key={step.id ?? `${step.skillId}-${idx}`}>
        {/* Main skill row */}
        <tr className={cn(
          "border-t transition-colors hover:bg-accent/50",
          step.isNew && "animate-highlight",
          step.isPrerequisite && "bg-muted/40"
        )}>
          <td className="px-2 py-1.5 font-mono text-[11px]">
            {idx + 1}
          </td>
          
          <td className="px-2 py-1.5">
            <div className={cn(
              "flex items-center gap-2",
              step.isPrerequisite && "pl-2"
            )}>
              {step.isPrerequisite && (
                <span className="text-muted-foreground">⤷</span>
              )}
              <span className="font-medium">{step.skillName}</span>
              {step.hasPrerequisites && (
                <button
                  type="button"
                  onClick={() => togglePrerequisites(idx)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ChevronRight className={cn(
                    "h-3 w-3 transition-transform",
                    step.prerequisitesExpanded && "rotate-90"
                  )} />
                </button>
              )}
            </div>
            {step.isPrerequisite && step.prerequisiteFor.length > 0 && (
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Required for {step.prerequisiteFor.length} skill{step.prerequisiteFor.length > 1 ? 's' : ''}
              </div>
            )}
          </td>
          
          <td className="px-2 py-1.5 text-center">
            <Badge variant="outline" className="font-mono text-[10px] px-1">
              {romanNumerals[step.targetLevel]}
            </Badge>
          </td>
          
          <td className="px-2 py-1.5 text-right font-mono text-[11px] text-muted-foreground">
            {formatTrainingTime(step.trainingTimeSeconds)}
          </td>
          
          <td className="px-2 py-1.5">
            <div className="flex items-center justify-end gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => moveStep(idx, -1)}
                    disabled={!step.canMoveUp}
                    className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-accent disabled:opacity-40"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {step.canMoveUp ? "Move up" : "Cannot move up"}
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => moveStep(idx, 1)}
                    disabled={!step.canMoveDown}
                    className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-accent disabled:opacity-40"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {step.canMoveDown ? "Move down" : "Cannot move down"}
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => removeStep(idx)}
                    disabled={!step.canRemove}
                    className="inline-flex h-6 w-6 items-center justify-center rounded text-destructive hover:bg-destructive/10 disabled:opacity-40"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {step.canRemove 
                    ? `Remove ${step.skillName}` 
                    : "Cannot remove - required by other skills"}
                </TooltipContent>
              </Tooltip>
            </div>
          </td>
        </tr>
        
        {/* Prerequisite rows (if expanded) */}
        {step.prerequisitesExpanded && step.hasPrerequisites && (
          <tr className="border-t bg-muted/20">
            <td colSpan={5} className="px-2 py-2">
              <PrerequisiteTree
                skillId={step.skillId}
                encyclopedia={encyclopedia}
                planSteps={enhancedSteps}
              />
            </td>
          </tr>
        )}
      </React.Fragment>
    ))}
  </tbody>
  
  {/* Footer with totals */}
  <tfoot className="bg-muted sticky bottom-0">
    <tr>
      <td colSpan={3} className="px-2 py-1.5 text-xs font-semibold">
        Total Training Time:
      </td>
      <td colSpan={2} className="px-2 py-1.5 text-right text-xs font-mono font-semibold">
        {formatTrainingTime(totalTrainingTime)}
      </td>
    </tr>
  </tfoot>
</table>
```

---

## 4. Level Selector on Add

### Current Behavior
- Clicking "Add" always adds skill at Level 1
- User must manually change level dropdown after adding

### Target Behavior
When adding a skill from the browser, show level selector:

```
Skill: Gunnery
Add at level: [I] [II] [III] [IV] [V]
              ^^^ Click desired level
```

### Implementation

**Option A: Inline Level Selector (Recommended)**
```tsx
function SkillAddButton({
  skillId,
  skillName,
  isInPlan,
  onAdd,
}: {
  skillId: number;
  skillName: string;
  isInPlan: boolean;
  onAdd: (skillId: number, level: number) => void;
}) {
  const [showLevelSelect, setShowLevelSelect] = useState(false);
  
  if (isInPlan) {
    return (
      <Button size="sm" variant="ghost" disabled className="h-7 px-2">
        <Check className="mr-1.5 h-3 w-3" />
        Added
      </Button>
    );
  }
  
  if (showLevelSelect) {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((level) => (
          <Tooltip key={level}>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-7 p-0 font-mono text-[10px]"
                onClick={() => {
                  onAdd(skillId, level);
                  setShowLevelSelect(false);
                }}
              >
                {romanNumerals[level]}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Add {skillName} Level {level}
            </TooltipContent>
          </Tooltip>
        ))}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={() => setShowLevelSelect(false)}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }
  
  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7 px-2"
      onClick={() => setShowLevelSelect(true)}
    >
      <Plus className="mr-1.5 h-3 w-3" />
      Add
    </Button>
  );
}
```

**Option B: Popover Level Selector**
```tsx
<Popover>
  <PopoverTrigger asChild>
    <Button size="sm" variant="outline">
      <Plus className="mr-1.5 h-3 w-3" />
      Add
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-48">
    <div className="space-y-2">
      <p className="text-xs font-medium">Add at level:</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((level) => (
          <Button
            key={level}
            size="sm"
            variant="outline"
            onClick={() => onAdd(skillId, level)}
          >
            {romanNumerals[level]}
          </Button>
        ))}
      </div>
    </div>
  </PopoverContent>
</Popover>
```

**Recommended**: Option A (Inline) - More direct, faster UX

---

## 5. Prerequisite Tree Component

### Visual Design
```
└─ Prerequisites for Caldari Frigate III:
   ├─ Spaceship Command III ✓ (in plan)
   └─ Caldari Frigate I ✓ (in plan)
       └─ Spaceship Command I ✓ (in plan)
```

### Implementation

```tsx
interface PrerequisiteTreeProps {
  skillId: number;
  encyclopedia: SkillEncyclopedia;
  planSteps: EnhancedPlanStep[];
}

function PrerequisiteTree({
  skillId,
  encyclopedia,
  planSteps,
}: PrerequisiteTreeProps) {
  const skill = encyclopedia.skills.find(s => s.skillId === skillId);
  if (!skill || skill.prerequisites.length === 0) return null;
  
  const planSkillIds = new Set(planSteps.map(s => s.skillId));
  
  function renderPrerequisite(
    prereq: { skillId: number; requiredLevel: number },
    depth: number = 0
  ) {
    const prereqSkill = encyclopedia.skills.find(s => s.skillId === prereq.skillId);
    if (!prereqSkill) return null;
    
    const isInPlan = planSkillIds.has(prereq.skillId);
    const indent = '  '.repeat(depth);
    
    return (
      <div key={prereq.skillId} className="text-xs">
        <div className="flex items-center gap-2 py-1">
          <span className="text-muted-foreground font-mono">{indent}├─</span>
          <span className={cn(
            isInPlan ? "text-foreground" : "text-muted-foreground"
          )}>
            {prereqSkill.name} {romanNumerals[prereq.requiredLevel]}
          </span>
          {isInPlan && (
            <Check className="h-3 w-3 text-primary" />
          )}
          {!isInPlan && (
            <Button
              size="sm"
              variant="ghost"
              className="h-5 px-2 text-[10px]"
              onClick={() => handleAddMissingPrerequisite(prereq.skillId, prereq.requiredLevel)}
            >
              <Plus className="mr-1 h-2 w-2" />
              Add
            </Button>
          )}
        </div>
        
        {/* Recursively render sub-prerequisites */}
        {prereqSkill.prerequisites.length > 0 && (
          <div className="ml-2">
            {prereqSkill.prerequisites.map(subPrereq => 
              renderPrerequisite(subPrereq, depth + 1)
            )}
          </div>
        )}
      </div>
    );
  }
  
  return (
    <div className="space-y-1 rounded-md border-l-2 border-primary/20 bg-muted/20 p-3">
      <div className="text-xs font-semibold text-muted-foreground mb-2">
        Prerequisites for {skill.name}:
      </div>
      {skill.prerequisites.map(prereq => renderPrerequisite(prereq))}
    </div>
  );
}
```

---

## 6. Movement Constraint Logic

### Rules
1. **Prerequisites must come before dependent skills**
   - Can't move a skill above its prerequisites
   - Can't move a prerequisite below its dependent skills

2. **Multiple level training**
   - User can add "Gunnery II" then later add "Gunnery V"
   - System should handle multiple entries for same skill
   - Prerequisites only need to be in plan once (at the highest required level)

3. **Visual indicators**
   - Disabled move buttons when movement would violate constraints
   - Tooltips explaining why movement is blocked

### Implementation

```typescript
function canMoveStep(
  steps: EnhancedPlanStep[],
  fromIndex: number,
  toIndex: number,
  encyclopedia: SkillEncyclopedia
): { canMove: boolean; reason?: string } {
  if (toIndex < 0 || toIndex >= steps.length) {
    return { canMove: false, reason: "Invalid position" };
  }
  
  const step = steps[fromIndex];
  const skillData = encyclopedia.skills.find(s => s.skillId === step.skillId);
  if (!skillData) return { canMove: true };
  
  // Check if moving would place skill before its prerequisites
  for (const prereq of skillData.prerequisites) {
    const prereqIndex = steps.findIndex(s => 
      s.skillId === prereq.skillId && s.targetLevel >= prereq.requiredLevel
    );
    
    if (prereqIndex !== -1 && toIndex < prereqIndex) {
      const prereqName = steps[prereqIndex].skillName;
      return {
        canMove: false,
        reason: `Must train ${prereqName} first (prerequisite)`
      };
    }
  }
  
  // Check if this skill is a prerequisite for skills that would come before it
  if (step.isPrerequisite) {
    for (const dependentSkillId of step.prerequisiteFor) {
      const dependentIndex = steps.findIndex(s => s.skillId === dependentSkillId);
      if (dependentIndex !== -1 && toIndex > dependentIndex) {
        const dependentName = steps[dependentIndex].skillName;
        return {
          canMove: false,
          reason: `Required before ${dependentName}`
        };
      }
    }
  }
  
  return { canMove: true };
}
```

---

## 7. Implementation Checklist

### Phase 3A: Header & Import/Export (2-3 hours)
- [ ] Split header into 2-card layout
- [ ] Move Plan Name and Character Assignment to Card 1
- [ ] Move Description to Card 2
- [ ] Create Import/Export dropdown menu
- [ ] Integrate ImportDialog component
- [ ] Remove inline "Import from EVE" section
- [ ] Update all handler functions
- [ ] Test import/export flows

### Phase 3B: Enhanced Plan Steps (3-4 hours)
- [ ] Add `trainingTimeSeconds` calculation
- [ ] Create `EnhancedPlanStep` type
- [ ] Implement `enhanceStepsWithPrerequisites` function
- [ ] Update table UI to show Level and Time columns
- [ ] Add Roman numeral badges for levels
- [ ] Add total training time footer
- [ ] Add sticky table headers
- [ ] Test with various skill combinations

### Phase 3C: Level Selector & Prerequisites (2-3 hours)
- [ ] Implement inline level selector on Add button
- [ ] Update `handleAddSkillToPlan` to accept level parameter
- [ ] Create `PrerequisiteTree` component
- [ ] Add expand/collapse functionality
- [ ] Implement "Add missing prerequisite" feature
- [ ] Add prerequisite visual indicators (⤷ icon, indentation)
- [ ] Test prerequisite detection logic

### Phase 3D: Movement Constraints (1-2 hours)
- [ ] Implement `canMoveStep` validation function
- [ ] Add constraint checking to move handlers
- [ ] Update move button disabled states
- [ ] Add tooltips explaining constraints
- [ ] Test complex prerequisite chains
- [ ] Test edge cases (circular dependencies, etc.)

### Phase 3E: Testing & Polish (1-2 hours)
- [ ] Test all import/export flows
- [ ] Test adding skills at different levels
- [ ] Test prerequisite expansion/collapse
- [ ] Test movement constraints
- [ ] Test with empty plans
- [ ] Test with large plans (50+ skills)
- [ ] Verify no linting errors
- [ ] Check accessibility (keyboard navigation)
- [ ] Test mobile responsiveness
- [ ] Performance check (rendering 100+ skills)

---

## 8. Data Flow Diagram

```
User Actions
    │
    ├─> Add Skill (with level)
    │   └─> Calculate prerequisites
    │       └─> Add to stepsDraft
    │           └─> Trigger re-enhancement
    │
    ├─> Move Skill
    │   └─> Validate constraints
    │       └─> If valid: reorder stepsDraft
    │           └─> Trigger re-enhancement
    │
    ├─> Remove Skill
    │   └─> Check if prerequisite
    │       └─> If safe: remove from stepsDraft
    │           └─> Trigger re-enhancement
    │
    ├─> Import from EVE
    │   └─> Parse text
    │       └─> Map to skill IDs
    │           └─> Replace stepsDraft
    │               └─> Trigger re-enhancement
    │
    └─> Save Plan
        └─> Send to API
            └─> Persist to database

Enhancement Pipeline:
stepsDraft[] 
  → enhanceStepsWithPrerequisites(steps, encyclopedia)
  → EnhancedPlanStep[]
  → Render in table
```

---

## 9. API Considerations

### Current API
Appears to support:
- `POST /skill-plans` - Create plan
- `GET /skill-plans/:id` - Get plan with steps
- `PUT /skill-plans/:id` - Update plan
- `POST /skill-plans/:id/import` - Import EVE text
- `GET /skill-plans/:id/export` - Export EVE text

### No Changes Required
The backend already supports multiple steps with skill ID and target level. All prerequisite logic and enhancement happens client-side.

### Future Enhancement (Optional)
Could add server-side validation:
```typescript
POST /skill-plans/:id/validate
{
  steps: [...],
  validate: ["prerequisites", "ordering", "duplicates"]
}
→ Returns validation errors
```

---

## 10. Testing Scenarios

### Critical Paths
1. **Basic flow**: Create plan → Add skills → Save → Reload → Verify persisted
2. **Level granularity**: Add Gunnery I, then Gunnery III, then Gunnery V → All should appear separately
3. **Prerequisites**: Add complex skill → Verify prerequisites detected → Expand tree → Add missing prereq → Verify order
4. **Constraints**: Try moving skill above prerequisite → Should be blocked with clear message
5. **Import**: Paste EVE text → Preview → Verify skills parsed → Replace plan → Verify applied
6. **Export**: Create plan → Export as EVE text → Verify format matches EVE

### Edge Cases
- Empty plan (no steps)
- Single step plan
- Plan with 100+ steps
- Skills with circular prerequisites (shouldn't exist in EVE data, but handle gracefully)
- Adding duplicate skill at same level (should warn or prevent)
- Character with no attributes selected (use defaults)

---

## 11. Roman Numerals Helper

```typescript
const romanNumerals: Record<number, string> = {
  1: 'I',
  2: 'II',
  3: 'III',
  4: 'IV',
  5: 'V',
};
```

---

## 12. File Structure

```
apps/web/app/characters/skills/plans/
├── page.tsx                          # Main page component
├── components/
│   ├── ImportDialog.tsx              # ✅ Created
│   ├── PrerequisiteTree.tsx          # 🆕 To create
│   ├── EnhancedPlanStepsTable.tsx    # 🆕 To create (optional, for organization)
│   └── SkillLevelSelector.tsx        # 🆕 To create (optional)
└── utils/
    ├── trainingTime.ts               # 🆕 Training time calculations
    ├── prerequisites.ts              # 🆕 Prerequisite detection & enhancement
    └── constraints.ts                # 🆕 Movement constraint validation
```

---

## 13. Success Criteria

### User Experience
- ✅ Users can see training time for each skill
- ✅ Users can add skills at specific levels (I-V)
- ✅ Users can see which skills are prerequisites
- ✅ Users can expand prerequisite trees
- ✅ System prevents invalid skill ordering
- ✅ Import/Export is clear and easy to find
- ✅ Page uses vertical space efficiently

### Technical
- ✅ No linting errors
- ✅ Type-safe throughout
- ✅ Performant with 100+ skills
- ✅ Accessible (keyboard navigation, screen readers)
- ✅ Responsive on mobile/tablet
- ✅ All existing functionality preserved

### Business Value
- ✅ Matches (and improves upon) in-game experience
- ✅ Reduces friction in skill planning workflow
- ✅ Provides clear value over in-game planning
- ✅ Sets foundation for future enhancements (templates, sharing, etc.)

---

## 14. Next Steps

1. **Review this specification** - Ensure alignment with requirements
2. **Set up fresh coding session** - Start with Phase 3A
3. **Implement systematically** - Follow checklist order
4. **Test incrementally** - Don't wait until end to test
5. **Get user feedback** - Test with real EVE players if possible

---

## 15. Notes & Considerations

### Performance
- Prerequisite calculation runs on every stepsDraft change
- With 100 skills × 5 prerequisites each = 500 checks
- Use memoization if performance issues arise
- Consider debouncing enhancement during rapid adds

### UX Refinements (Future)
- **Bulk actions**: Select multiple skills → Move together, Remove together
- **Templates**: Save common plans as templates
- **Sharing**: Generate shareable link or code
- **Comparison**: Compare plan vs character's current skills
- **Recommendations**: "You're 3 skills away from flying [Ship]"
- **Time to completion**: Show estimated completion date based on current training

### Accessibility
- All interactive elements keyboard accessible
- Proper ARIA labels for screen readers
- Focus management in dialogs
- High contrast mode support
- Reduced motion support (already implemented for animations)

---

**Document Version**: 1.0  
**Author**: AI Specification Generator  
**Ready for Implementation**: ✅ Yes  
**Estimated Completion**: 1-2 coding sessions (6-8 hours)

