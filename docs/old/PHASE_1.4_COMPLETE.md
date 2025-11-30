# Phase 1.4 Complete: Move Shared UI Components

**Date:** November 8, 2025  
**Status:** ✅ Complete

## Summary

Successfully migrated all shadcn UI components from `apps/web/components/ui/` to the shared `packages/ui/` package, making them reusable across all web applications in the monorepo.

## Changes Made

### 1. Package Setup

Created `packages/ui/` with proper configuration:

**`packages/ui/package.json`**:
- Added all Radix UI component dependencies
- Added `next-themes` for theme support
- Added utility dependencies: `clsx`, `tailwind-merge`, `lucide-react`, `recharts`, `sonner`
- Configured TypeScript build

**`packages/ui/tsconfig.json`**:
- Configured for React/JSX compilation
- Set up module resolution

### 2. Component Migration

Moved **26 shadcn UI components** from `apps/web/components/ui/` to `packages/ui/src/`:

- `alert-dialog.tsx`
- `alert.tsx`
- `avatar.tsx`
- `badge.tsx`
- `breadcrumb.tsx`
- `button.tsx`
- `card.tsx`
- `chart.tsx`
- `checkbox.tsx`
- `collapsible.tsx`
- `dialog.tsx`
- `dropdown-menu.tsx`
- `empty.tsx`
- `input.tsx`
- `label.tsx`
- `select.tsx`
- `separator.tsx`
- `sheet.tsx`
- `sidebar.tsx`
- `skeleton.tsx`
- `sonner.tsx`
- `table.tsx`
- `tabs.tsx`
- `textarea.tsx`
- `toast.tsx`
- `tooltip.tsx`

### 3. Utility Functions

Created `packages/ui/src/lib/utils.ts` with shared utilities:

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatIsk(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "-";
  }
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "ISK",
      currencyDisplay: "code",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
      .format(Number(value))
      .replace("ISK", "ISK");
  } catch {
    return String(value);
  }
}
```

### 4. Import Updates

Updated all imports in `apps/web/` from:
```typescript
import { Button } from "@/components/ui/button";
```

To:
```typescript
import { Button } from "@eve/ui";
```

**Files updated:**
- `apps/web/app/layout.tsx` - Updated `Toaster` and `Sidebar*` imports
- All files in `apps/web/app/arbitrage/` - Updated UI component imports
- All files in `apps/web/app/brokerage/` - Updated UI component imports
- All files in `apps/web/components/sidebar/` - Updated UI component imports

### 5. TypeScript Configuration

Updated `apps/web/tsconfig.json` with path alias:
```json
{
  "paths": {
    "@eve/ui": ["../../packages/ui/src/index.ts"],
    "@eve/ui/*": ["../../packages/ui/src/*"]
  }
}
```

### 6. Temporary Fixes

Added temporary compatibility code for old proxy routes (to be removed in Phase 6):

**`apps/web/lib/api-client.ts`**:
- Added `getApiClient()` stub function to support legacy proxy route files
- Fixed Next.js 15 async params breaking change in route handlers
- These will be removed when proxy routes are deleted in Phase 6

## Benefits

1. **Code Reuse**: UI components can now be shared across multiple web apps
2. **Centralized Maintenance**: Single source of truth for UI components
3. **Type Safety**: Full TypeScript support across packages
4. **Dependency Management**: Centralized UI dependencies
5. **Theme Support**: Built-in theme provider support with `next-themes`

## Build Verification

✅ Full production build successful:
- Web app builds successfully
- All TypeScript types resolve correctly
- No errors, only existing warnings
- 105 routes generated
- Static pages optimized

## Package Exports

The `@eve/ui` package exports all components through its main entry point:

```typescript
// Available from "@eve/ui"
export * from "./alert-dialog";
export * from "./alert";
export * from "./avatar";
// ... all 26 components
export * from "./lib/utils";
```

## Dependencies Installed

```json
{
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "@radix-ui/react-*": "Various versions",
  "next-themes": "^0.4.4",
  "clsx": "^2.1.1",
  "tailwind-merge": "^2.5.5",
  "lucide-react": "^0.469.0",
  "recharts": "^2.15.0",
  "sonner": "^1.7.3"
}
```

## Next Steps

Phase 1.4 is complete! The UI components are now properly centralized and ready for use across all web applications.

**Recommended next actions:**
- Phase 2: Create `@eve/api-contracts` package for shared DTOs/types
- Phase 6: Remove old proxy routes and update to use `@eve/api-client` directly
- Phase 8: Replace `fetchWithAuth` with the new `@eve/api-client` package

## Notes

- The original `apps/web/components/ui/` directory can be deleted (pending user confirmation)
- The `formatIsk` utility was already moved to the `ui` package for consistency
- All Tailwind CSS styling continues to work correctly through the shared `cn()` utility

