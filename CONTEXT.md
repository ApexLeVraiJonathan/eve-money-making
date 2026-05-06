# EVE Money Making Context

Domain language for the EVE money-making app, used to keep code, plans, and architecture discussions aligned.

## Language

**Cycle**:
A trading period that groups investments, purchases, sales, profit, settlement, and rollover.
_Avoid_: round, batch

**Cycle Lifecycle**:
The ordered transitions a Cycle can move through from planned to open to settled.
_Avoid_: cycle management

**Open Cycle**:
The single Cycle currently accepting active trading activity.
_Avoid_: active cycle when it could imply more than one

**No Open Cycle Period**:
A deliberate pause after Cycle Settlement where no Cycle is open because trading is taking a break.
_Avoid_: inactive cycle when there is no Cycle accepting activity

**Cycle Settlement**:
The transition that imports wallet activity, allocates transactions, closes the Open Cycle, creates payouts, and processes rollover.
_Avoid_: close when referring to the full settlement workflow

**Settlement Report**:
The result of Cycle Settlement, including which Strict Settlement Steps succeeded and which Recoverable Settlement Steps need admin follow-up.
_Avoid_: log output

**Cycle Lifecycle Entry Point**:
The route-facing Module Interface for Cycle Lifecycle transitions.
_Avoid_: legacy controller orchestration

**Strict Settlement Step**:
A Cycle Settlement step that must succeed before the next Cycle can become the Open Cycle.
_Avoid_: required task

**Recoverable Settlement Step**:
A Cycle Settlement step whose failure should be surfaced for admin follow-up without necessarily blocking the next Open Cycle.
_Avoid_: optional task

**Cycle Rollover**:
Moving eligible value from a settled Cycle into the next Cycle according to participant rollover choices and program rules.
_Avoid_: reinvestment when it hides payout deductions or participant intent

**Rollover Intent**:
A participant's choice for how much eligible value should move into the next Cycle.
_Avoid_: preference when referring to a per-Cycle choice

## Relationships

- **Cycle Lifecycle** contains the allowed transitions for a **Cycle**.
- The **Cycle Lifecycle Entry Point** is the public Seam for opening a planned **Cycle** and for settling the current **Open Cycle** without opening a successor.
- The **Cycle Lifecycle Entry Point** may delegate to existing internal logic during refactor, but routes should not keep a parallel legacy workflow.
- At most one **Cycle** may be an **Open Cycle**.
- Opening a planned **Cycle** performs **Cycle Settlement** for the current **Open Cycle** first.
- Settling the current **Open Cycle** without opening a successor creates a **No Open Cycle Period**.
- **Cycle Settlement** produces a **Settlement Report**.
- Wallet import, transaction allocation, rollover buyback, and marking the current **Open Cycle** closed are **Strict Settlement Steps**.
- Payout creation and **Cycle Rollover** processing are **Recoverable Settlement Steps**.
- **Cycle Rollover** moves value from a settled **Cycle** into the next **Cycle**.
- If **Cycle Settlement** has no target **Cycle**, **Cycle Rollover** is skipped and **Rollover Intent** becomes payout/admin follow-up.
- **Cycle Rollover** is a first-class Module concept because it owns **Rollover Intent**, payout deductions, cap rules, program defaults, and idempotency.

## Example Dialogue

> **Dev:** "Should opening the next **Cycle** leave the previous **Open Cycle** running?"
> **Domain expert:** "No. There must only be one **Open Cycle**; opening the next **Cycle** should perform **Cycle Settlement** for the current one."
>
> **Dev:** "If payout creation fails, should the next **Cycle** still open?"
> **Domain expert:** "Yes, if the **Strict Settlement Steps** succeeded. Surface failed **Recoverable Settlement Steps** for admin follow-up."
>
> **Dev:** "Should **Cycle Rollover** just be payout logic?"
> **Domain expert:** "No. **Cycle Rollover** is its own concept because it combines participant intent, payout deductions, caps, program defaults, and idempotency."
>
> **Dev:** "What should the first refactor deepen?"
> **Domain expert:** "Start with **Cycle Lifecycle** so the public workflow and **Settlement Report** are clear before extracting **Cycle Rollover**."
>
> **Dev:** "Should the route keep calling the old workflow while the new **Cycle Lifecycle Entry Point** is added?"
> **Domain expert:** "No. Switch the route to the **Cycle Lifecycle Entry Point** immediately so there is one workflow."
>
> **Dev:** "Can the **Cycle Lifecycle Entry Point** delegate to existing internals during the first refactor?"
> **Domain expert:** "Yes, as long as routes use the new entry point and there is no parallel public legacy workflow."
>
> **Dev:** "Can admins perform **Cycle Settlement** without opening the next **Cycle**?"
> **Domain expert:** "Yes. That creates a **No Open Cycle Period** when trading is taking a break."
>
> **Dev:** "Should **Rollover Intent** carry forward during a **No Open Cycle Period**?"
> **Domain expert:** "No. If there is no target **Cycle**, pending value should become payout/admin follow-up instead of holding user ISK for an unknown future Cycle."

## Flagged Ambiguities

- "close" can mean only marking a **Cycle** closed, or the full **Cycle Settlement** workflow. Use **Cycle Settlement** for the full workflow.
