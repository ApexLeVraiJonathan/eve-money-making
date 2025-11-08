# @eve/ui

Shadcn component library shared across all web applications.

## Purpose

Contains reusable UI components built with:

- [shadcn/ui](https://ui.shadcn.com/)
- Tailwind CSS
- Radix UI primitives

## Structure

Components will be migrated here from `apps/web/components/ui/` during Phase 1.4.

## Usage

```typescript
import { Button, Card, Input } from "@eve/ui";

function MyComponent() {
  return (
    <Card>
      <Input placeholder="Enter text" />
      <Button>Submit</Button>
    </Card>
  );
}
```

## Guidelines

- Keep components generic and reusable
- App-specific components stay in `apps/*/components/`
- Follow existing shadcn patterns for consistency
