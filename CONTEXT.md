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

**Participation**:
A user's committed ISK position in a specific Cycle, including payment status, validation status, payout or rollover outcome, and any program-specific behavior like JingleYield.
_Avoid_: investment when referring to the full lifecycle through validation, settlement, payout, refund, rollover, or program completion

**Payment Matching**:
The admin/system process that connects incoming wallet journal payments to pending Participations, turning raw ISK transfers into validated or partially matched Participation payment evidence.
_Avoid_: allocation when referring to Participation payments

**JingleYield Program**:
A first-class program that creates and owns specialized Participations with program rules such as minimum Cycles, principal handling, interest targets, completion behavior, and rollover/backfill cases.
_Avoid_: treating it as only a normal Participation when program rules matter

**Admin Recovery Flow**:
A product/API-supported admin action that repairs, completes, or records follow-up for an imperfect money workflow state, such as unmatched Participation payments, refunds, payout marking, recoverable Settlement Report failures, or JingleYield rollover backfill.
_Avoid_: ad hoc script when the action is an official operational path

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
- A **Participation** belongs to one **Cycle** and carries the user's committed ISK through payment matching, validation, settlement, payout, refund, rollover, or program completion.
- **Payment Matching** validates **Participation** payments from wallet journal transfers and is separate from **Transaction Allocation**, which allocates buy/sell wallet activity to Cycle Lines during trading or **Cycle Settlement**.
- A **JingleYield Program** creates specialized **Participations** whose payout, rollover, and completion behavior are governed by program rules.
- An **Admin Recovery Flow** handles imperfect money workflow states through product/API features; standalone scripts are support tooling unless explicitly promoted to an official operational path.

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
>
> **Dev:** "Is a **Participation** just an investment request?"
> **Domain expert:** "No. A **Participation** is the user's committed ISK position in a **Cycle** and continues through validation, settlement, payout, refund, rollover, or program completion."
>
> **Dev:** "Is **Payment Matching** the same as **Transaction Allocation**?"
> **Domain expert:** "No. **Payment Matching** connects incoming wallet payments to **Participations**. **Transaction Allocation** connects buy/sell wallet activity to Cycle Lines."
>
> **Dev:** "Can **JingleYield Program** behavior be covered by normal **Participation** tests?"
> **Domain expert:** "No. **JingleYield Program** is first-class because its minimum Cycles, principal handling, interest targets, completion, rollover, and backfill rules change the expected outcomes."
>
> **Dev:** "Should standalone scripts be part of **Admin Recovery Flow**?"
> **Domain expert:** "No, not by default. **Admin Recovery Flow** means product/API-supported recovery unless a script is explicitly made an official operational path."

## Flagged Ambiguities

- "close" can mean only marking a **Cycle** closed, or the full **Cycle Settlement** workflow. Use **Cycle Settlement** for the full workflow.
