## JingleYield Promotion – Seeded 2B Principal

JingleYield is a Tradecraft promotion that seeds eligible users with a locked
**2B ISK principal**, funded by an admin character, to help them start
investing in the market fund.

- The 2B principal is **admin-funded** and **locked** while the program is
  active (user cannot withdraw it).
- Users can:
  - Withdraw **profits above 2B** each cycle, or reinvest them.
  - Add their own principal up to the normal **10B principal / 20B total**
    caps.
- JingleYield completes when:
  - At least 12 cycles have run (operational guideline), and/or
  - The user has earned **≈2B ISK of interest** (implementation uses a 2B
    interest target).
- On completion, the system:
  - Creates an **admin-tagged ledger entry** repaying the 2B principal back to
    the configured admin character.
  - Marks the JingleYield program as completed; the user continues with any
    remaining user-funded principal and interest as a normal participant.

### Admin Workflow

1. **Create a JingleYield participation** (admin UI):
   - Go to Tradecraft **Admin → Participations**.
   - Use the **“Create JingleYield Participation”** form:
     - Select the target **user**.
     - Enter the **planned cycle ID**.
     - Choose the **admin character** funding the 2B.
     - Provide the **display character name** for the investor.
   - This creates:
     - A 2B `CycleParticipation` in the planned cycle.
     - A linked `JingleYieldProgram` row for lifecycle tracking.

2. **Track programs**:
   - Use **Admin → JingleYield** to see:
     - Status (`ACTIVE`, `COMPLETED_CONTINUING`, etc.).
     - Locked principal, cumulative interest vs 2B target.
     - Cycles completed and start/completion cycles.

3. **Repayment**:
   - When a program reaches its interest target, the backend:
     - Writes an admin-tagged `cycle_ledger` payout entry for 2B.
     - Sets the program status to `COMPLETED_CONTINUING` and unlocks the
       principal.

### User Experience

- Users see their JingleYield status under **Tradecraft → My Investments**:
  - Banner showing:
    - Locked 2B ISK principal.
    - Interest earned vs 2B target.
    - Cycles completed vs minimum.
- They still use the normal participation / rollover flows, with the funding
  logic enforcing that the 2B base stays invested while JingleYield is active.


