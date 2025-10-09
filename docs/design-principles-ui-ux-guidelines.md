## Design Principles & UI/UX Guidelines (Fantasy-Themed SaaS)

This guide defines how we design and implement UI across the app using Tailwind CSS and our component system (Shadcn/UI). It balances a clean SaaS aesthetic with subtle fantasy/e-sports flair, prioritizing clarity, consistency, and accessibility.

### TL;DR

- **Consistency first**: Reuse the same components, variants, spacing, and typography everywhere.
- **Clear hierarchy**: Make primary actions and headings visually dominant; keep secondary info quieter.
- **Whitespace**: Prefer generous spacing, clean grouping, and alignment to reduce cognitive load.
- **Color discipline**: Limited palette; consistent roles; strong contrast; accent used sparingly.
- **Depth lightly**: Subtle shadows and elevation for emphasis; avoid heavy/neon effects.
- **Right pattern**: Use the right UI component (card/table/dialog/tabs) for the content.
- **Responsive by default**: Mobile-considerate layouts; fluid grids; touch-friendly targets.
- **Tailwind utilities**: Stick to theme tokens and utilities; avoid ad-hoc custom CSS.
- **Accessibility**: Sufficient contrast, visible focus, readable type, not color-only meaning.
- **Shadcn workflow**: Scaffold via CLI, then customize variants and theme tokens centrally.

## Consistency & Cohesive Theme

### Unified Visual Style

- Use a single brand palette, shared typography scale, and common spacing rhythm across all pages.
- Keep primary CTAs visually consistent (same color and size) app-wide.

### Design System & Components

- Prefer existing components from `components/ui` and established variants over bespoke markup.
- Keep repeated UI (buttons, cards, forms, tables, dialogs) identical in structure and spacing.

### Theming

- Apply the fantasy theme subtly and consistently (icons, borders, textures, glows) without reducing usability.
- Theme via CSS variables/tokens so updates propagate uniformly.

### Internal & External Consistency

- Internal: same nav placement, page layout, and component hierarchy throughout.
- External: follow web conventions (e.g., gear for settings, magnifier for search) and familiar placements.

## Visual Hierarchy & Clarity

### Headings & Grouping

- Use clear page titles, section headers, and logical grouping. Cards and separators help scannability.

### Typography

- Readable base size (Tailwind `text-base`), consistent heading scale, adequate line height.
- Avoid decorative or all-caps body copy; limit the number of distinct text sizes.

### Icons & Visual Aids

- Use standard, recognizable icons paired with labels when ambiguous.
- Use icons to enhance comprehension, not replace essential text.

## Layout & Whitespace

### Whitespace

- Treat empty space as a design tool; add breathable margins/padding using Tailwind’s scale.

### Balance & Alignment

- Align to a grid; keep spacing consistent. Ensure labels align to inputs and headers to content.

### Avoid Overcrowding

- Chunk content into cards, tabs, or accordions. Don’t overload screens; progressively disclose detail.

### Responsive Spacing

- Increase spacing on larger breakpoints; stack sections with sufficient gaps on small screens.

## Color & Contrast

### Limited Palette

- Use the 60-30-10 rule: neutral background (60%), secondary surfaces (30%), accent (10%).

### Purposeful Roles

- Define and reuse roles (primary, secondary, info, success, warning, error). Keep them consistent.

### Contrast & Readability

- Meet/aim for WCAG contrast. Avoid low-contrast text and ensure interactive elements stand out.

### Thematic Accents

- Use fantasy/e-sports accents sparingly for highlights, not large backgrounds.

### State Colors

- Use consistent colors for validation states; never rely on color alone—pair with text/icons.

## Depth & Emphasis

### Shadows & Elevation

- Subtle shadows (`shadow-sm/md`) and rounded corners (`rounded-md/lg`) to indicate layering.

### Consistent Lighting

- Keep a uniform lighting direction (assume light from above). Elevation matches importance.

### Avoid Overdoing

- Avoid harsh drop-shadows and neon glows. Favor modern, restrained depth cues.

### Other Cues

- Use overlays, opacity, and blur sparingly to create depth (e.g., modal backdrops).

## UI Components & Patterns

### Choose the Right Pattern

- Lists/cards for repeated items; tables for comparisons; steppers for flows; dialogs/popovers for secondary actions; tabs/accordions for distinct sections.

### Component Consistency

- Similar data/function → similar card/table/dialog across the app. Reuse patterns.

### Tailwind & Frameworks

- Use Tailwind utilities and proven component patterns; avoid ad-hoc structures.

### Example Components

- Navigation, Cards, Tables, Forms, Buttons (primary/secondary/outline), Dialogs, Tooltips.

## Responsiveness & Adaptive Design

### Multi-Screen Support

- Use Tailwind breakpoints (`sm`, `md`, `lg`, `xl`) to adapt layouts gracefully.

### Mobile-First Mindset

- Prioritize core content; avoid fixed widths; scale typography and spacing as screens grow.

### Fluid Layouts & Breakpoints

- Use flex/grid with `%`/flex-basis; ensure images scale; allow horizontal scroll for wide tables on mobile.

### Consistency Across Devices

- Keep the same visual identity and patterns; change layout density only.

### Test & Iterate

- Validate layouts at multiple sizes; wrap long titles; ensure tables scroll on small screens.

### Touch-Friendly Targets

- Ensure comfortable tap sizes and spacing; avoid tightly packed controls.

## Tailwind CSS Implementation Best Practices

### Utility-First Consistency

- Use theme tokens for spacing/colors/typography; avoid arbitrary values.

### Global Styles & Theme

- Centralize tokens (e.g., in `globals.css`); update tokens to restyle the app uniformly.

### Responsive & State Utilities

- Apply `sm:/md:/lg:` variants and `hover:/focus:/active:` states; keep focus visible.

### Avoid Custom CSS

- Prefer utilities; add minimal custom CSS only for what Tailwind can’t do cleanly.

### Patterns to Prefer

- `gap-*` for consistent spacing; `shadow-sm/md` for depth; `rounded-md/lg/full` for radii; `dark:` variants if dark mode is enabled.

### Component Structure

- Build reusable components with clear APIs. Keep variants in component source for consistency.

## Usability & UX

### Simplicity & Usability

- Every design choice should improve clarity or task efficiency. Remove unnecessary flourishes.

### Heuristics

- Visibility of status, clear feedback, accessible interactions, error prevention and recovery.

### Content First

- Prioritize the user’s main goal on each screen; ensure the primary action is obvious.

### Iterate

- Review spacing, alignment, hierarchy, color balance, accessibility; refine until cohesive.

## Shadcn/UI with Tailwind

### What & Why

- Shadcn/UI provides accessible, Tailwind-styled component blueprints that become our code.

### Workflow

- Scaffold via CLI (e.g., `npx shadcn-ui@latest add card`), then refine styles/variants locally.

### Direct Customization

- Modify component code directly to align with our design system (preferred over overrides).

### Theming with Tokens

- Use CSS variables for colors/spacing/typography. Tools like TweakCN can generate theme tokens; apply in `:root` and `.dark` to theme globally.

### Variants & CVA

- Define/extend component variants with CVA so looks remain consistent and easily reusable.

### Managing Updates

- Re-add components via CLI when needed; diff and reapply local changes thoughtfully.

## Quick Checklists

### Designer/PM Review

- **Consistency**: Same components/variants/spacing across pages
- **Hierarchy**: Clear primary actions and headings; secondary info subdued
- **Readability**: Adequate font sizes and line heights
- **Color**: Limited palette; consistent roles; strong contrast
- **Depth**: Subtle, consistent shadows; no heavy/neon effects
- **Pattern fit**: Chosen component matches the content and task
- **Responsiveness**: Works at `sm`→`xl`; content stacks with comfortable gaps
- **Accessibility**: Focus visible; not color-only; labels present; touch-friendly

### Developer Handoff

- Use existing `components/ui/*` components and variants
- Follow Tailwind theme tokens; avoid arbitrary CSS
- Add responsive/state variants in markup (`sm:` `md:` `hover:` `focus:`)
- Keep shadows/radii consistent (`shadow-sm/md`, `rounded-md/lg`)
- Validate contrast, focus, and keyboard nav before PR
