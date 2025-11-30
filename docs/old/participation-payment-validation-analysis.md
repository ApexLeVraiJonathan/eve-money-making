# Participation Payment Validation - Current State & Gaps

## Current Implementation

### 1. **Participation Creation** ✅

- **Location**: `apps/api/src/ledger/ledger.service.ts::createParticipation()`
- **Flow**:
  - User opts into cycle with amount
  - System generates unique memo: `ARB {cycleId} {characterName}`
  - Creates participation with status `AWAITING_INVESTMENT`
- **Fields stored**:
  - `amountIsk`: Expected donation amount (Decimal 28,2)
  - `memo`: Unique identifier for matching
  - `status`: ParticipationStatus enum
  - `walletJournalId`: Link to matching journal entry (nullable)
  - `validatedAt`: Timestamp when validated

### 2. **Manual Validation** ✅

- **Location**: `apps/api/src/ledger/ledger.service.ts::adminValidatePayment()`
- **Flow**:
  - Admin manually calls endpoint with participationId
  - Optionally provides `walletJournal: { characterId, journalId }`
  - Updates status to `OPTED_IN` (note: should probably be `CONFIRMED`)
  - Sets `validatedAt` timestamp
  - Links `walletJournalId` if provided
  - Creates deposit ledger entry for the cycle
- **Issues**:
  - No validation that amount matches
  - No validation that memo matches
  - Status changes to `OPTED_IN` instead of `CONFIRMED`

### 3. **Wallet Journal Collection** ✅

- **Location**: `apps/api/src/wallet/wallet.service.ts::importForCharacter()`
- **Data collected**:
  - `journalId`: Unique BigInt identifier
  - `characterId`: Which character received the payment
  - `date`: When payment occurred
  - `refType`: Type of transaction (e.g., 'player_donation')
  - `amount`: ISK amount (Decimal 28,2)
  - `description`: **Contains the memo text**
  - `firstPartyId`, `secondPartyId`: Sender/receiver IDs
  - `balance`, `tax`, etc.

### 4. **ParticipationStatus Enum** ✅

From schema: `AWAITING_INVESTMENT`, `OPTED_IN`, `OPTED_OUT`, `REFUNDED`, `PAID_OUT`

- Missing: `CONFIRMED` status (payment validated but not yet opted into cycle)

---

## Gaps & Missing Logic

### ❌ **No Automated Matching Job**

- No scheduled job to match wallet journals to participations
- System relies entirely on manual admin validation

### ❌ **No Partial Payment Detection**

- Can't detect when someone sends less than expected
- Example: Expected 5B ISK, received 4.5B ISK

### ❌ **No Wrong Memo Detection**

- Can't detect when payment is received but memo is incorrect
- Example: Sent "ARB cycle1 WrongName" instead of "ARB cycle1 CorrectName"

### ❌ **No Multi-Character Support**

- Participation linked to characterName (string) not characterId
- User might send from different character than they specified
- Need to support: "I said I'd send as CharA but actually sent as CharB"

---

## Required Matching Logic

### Scenario 1: **Full Payment - Correct Memo** ✅ PERFECT

```
Participation: amountIsk = 5000000000.00, memo = "ARB cycle1 Player"
Journal Entry: amount = 5000000000.00, description = "ARB cycle1 Player"
Action: Set status = CONFIRMED, link journalId, set validatedAt
```

### Scenario 2: **Partial Payment - Correct Memo** ⚠️ NEEDS REVIEW

```
Participation: amountIsk = 5000000000.00, memo = "ARB cycle1 Player"
Journal Entry: amount = 4500000000.00, description = "ARB cycle1 Player"
Options:
  A) Accept partial, create ledger entry for actual amount
  B) Flag for admin review (recommended)
  C) Auto-reject and mark for refund
```

### Scenario 3: **Full Payment - Wrong Memo** ⚠️ NEEDS ADMIN

```
Participation: amountIsk = 5000000000.00, memo = "ARB cycle1 Player"
Journal Entry: amount = 5000000000.00, description = "ARB cycle1 Typo"
Action: Flag for manual admin matching
- Show in admin UI with "possible match" suggestion
- Admin can manually link or reject
```

### Scenario 4: **No Memo** ⚠️ NEEDS ADMIN

```
Participation: amountIsk = 5000000000.00, memo = "ARB cycle1 Player"
Journal Entry: amount = 5000000000.00, description = "" or null
Action: Cannot auto-match, flag for admin review
- Match by: amount, characterId, date proximity
```

### Scenario 5: **Payment Not Received Yet** ℹ️ NO ACTION

```
Participation: status = AWAITING_INVESTMENT, createdAt = 2 days ago
Journal Entry: None
Action: Keep status, maybe show "overdue" warning after 7 days
```

### Scenario 6: **Overpayment** ⚠️ NEEDS POLICY

```
Participation: amountIsk = 5000000000.00, memo = "ARB cycle1 Player"
Journal Entry: amount = 6000000000.00, description = "ARB cycle1 Player"
Options:
  A) Accept full amount as investment
  B) Accept expected amount, flag excess for refund
  C) Flag for admin review
```

---

## Recommended Implementation

### 1. **Add Matching Job** (Critical)

Create: `apps/api/src/ledger/ledger.service.ts::matchParticipationPayments()`

```typescript
async matchParticipationPayments(cycleId?: string) {
  // Get all AWAITING_INVESTMENT participations
  const participations = await this.prisma.cycleParticipation.findMany({
    where: {
      status: 'AWAITING_INVESTMENT',
      ...(cycleId ? { cycleId } : {}),
    },
  });

  // Get all unlinked player_donation journal entries
  const journals = await this.prisma.walletJournalEntry.findMany({
    where: {
      refType: 'player_donation',
      // Not already linked to a participation
    },
  });

  for (const p of participations) {
    // Try exact memo match first
    const exactMatch = journals.find(j =>
      j.description?.includes(p.memo)
    );

    if (exactMatch) {
      // Check amount
      const expectedAmount = Number(p.amountIsk);
      const actualAmount = Number(exactMatch.amount);

      if (actualAmount === expectedAmount) {
        // Perfect match - auto-confirm
        await this.adminValidatePayment({
          participationId: p.id,
          walletJournal: {
            characterId: exactMatch.characterId,
            journalId: exactMatch.journalId,
          },
        });
      } else if (actualAmount < expectedAmount) {
        // Partial payment - flag for review
        // TODO: Add "PARTIAL_PAYMENT" status or flag
      } else {
        // Overpayment - flag for review
        // TODO: Add "OVERPAYMENT" status or flag
      }
    }
  }
}
```

### 2. **Add Status Enum Value**

Add to `ParticipationStatus`:

- `CONFIRMED` - Payment validated, awaiting cycle open
- Consider: `PARTIAL_PAYMENT`, `OVERPAYMENT`, `UNMATCHED_PAYMENT`

### 3. **Improve adminValidatePayment**

- Add amount validation
- Add memo validation
- Return validation errors/warnings
- Support partial confirmations

### 4. **Add Admin UI Trigger** (User Request)

- Add tab in `/arbitrage/admin/triggers`
- Show:
  - Count of AWAITING_INVESTMENT participations
  - List of unmatched payments (journals without participation)
  - List of participations awaiting payment (with age)
- Action: "Match Payments" button to trigger the job

### 5. **Add Matching History/Audit**

- Log all auto-matches
- Log all manual admin overrides
- Track who validated what and when

---

## Database Schema Considerations

### Add fields to `CycleParticipation`?

- `actualAmountReceived`: Decimal? (if different from amountIsk)
- `matchStatus`: Enum? ('auto_matched', 'manual_matched', 'unmatched')
- `matchedByUserId`: String? (for admin audit)

### Add `walletJournalId` index

- Currently nullable, not indexed
- Should index for faster lookups

### Add `PaymentMatch` audit table?

```prisma
model PaymentMatch {
  id                    String   @id @default(uuid())
  participationId       String
  walletJournalId       BigInt
  characterId           Int
  matchType            String   // 'auto_exact', 'auto_partial', 'manual'
  matchedByUserId      String?
  createdAt            DateTime @default(now())
}
```

---

## Questions for User ✅ ANSWERED

1. **Partial Payments**: ✅ Auto-accept, update investment amount. Support multiple payments (sum them).
2. **Overpayments**: ✅ Accept full amount, update investment amount in DB.
3. **Wrong Character**: ✅ Accept, update to actual payer character (for payouts).
4. **Memo Typos**: ✅ Fuzzy matching implemented (Levenshtein distance, up to 3 characters).
5. **Multiple Payments**: ✅ Supported - sum all payments with same memo.
6. **Refund Workflow**: ✅ Manual, done in-game (no ESI support for sending donations).
7. **Grace Period**: ✅ No overdue tracking. Clean up unpaid participations when cycle opens.
8. **Notification**: ❌ Not implemented (future feature).

---

## ✅ IMPLEMENTED

### 1. **Automated Matching Job**

**Location**: `apps/api/src/ledger/ledger.service.ts::matchParticipationPayments()`

**Features**:

- ✅ Exact memo matching (highest priority)
- ✅ Fuzzy memo matching with Levenshtein distance (up to 3 character differences)
- ✅ Multiple payment support (sums payments with same/similar memo)
- ✅ Partial/overpayment handling (updates investment amount to actual received)
- ✅ Wrong character handling (updates to actual payer for payout purposes)
- ✅ Only considers donations to LOGISTICS role characters
- ✅ Returns unmatched payments for admin review

**Scoring System**:

- Exact memo match: 1000 points
- Contains memo: 500 points
- Fuzzy match (≤3 char diff): 100-70 points
- Amount matches exactly: +50 bonus points
- Minimum score threshold: 100 (good matches only)

### 2. **Cycle Opening Cleanup**

**Location**: `apps/api/src/ledger/ledger.service.ts::openPlannedCycle()`

**Changes**:

- ✅ Automatically deletes all `AWAITING_INVESTMENT` participations when cycle opens
- ✅ Ensures initial capital calculation only includes confirmed participations

### 3. **Admin UI Trigger**

**Location**: `apps/web/app/arbitrage/admin/triggers/page.tsx`

**Features**:

- ✅ New "Participations" tab in Triggers admin page
- ✅ "Match All Payments" button
- ✅ Shows match results:
  - Total matched count
  - Amount adjusted count (partial/overpayments)
  - Unmatched payments table (date, character ID, amount, memo)
- ✅ Clear explanation of how matching works

### 4. **Controller Endpoint**

**Location**: `apps/api/src/ledger/ledger.controller.ts`

**Endpoint**: `POST /ledger/participations/match?cycleId={optional}`

- ✅ Admin-only (requires `ADMIN` role)
- ✅ Optional `cycleId` parameter to match specific cycle
- ✅ Returns match statistics and unmatched payments

### 5. **Next.js API Route**

**Location**: `apps/web/app/api/ledger/participations/match/route.ts`

**Features**:

- ✅ Proxies request to NestJS backend
- ✅ Passes authentication token
- ✅ Supports optional `cycleId` query parameter

---

## Status Transitions

### Before:

```
User Opts In → AWAITING_INVESTMENT → (manual admin validation) → OPTED_IN
```

### After:

```
User Opts In → AWAITING_INVESTMENT → (auto-match or admin trigger) → OPTED_IN
                                   → (if no payment when cycle opens) → DELETED
```

---

## Testing Checklist

1. ✅ User opts in with correct memo → Payment received → Auto-matches
2. ✅ User sends partial payment → Updates investment amount
3. ✅ User sends overpayment → Accepts full amount
4. ✅ User typos memo (1-3 chars) → Fuzzy matches
5. ✅ User sends from different character → Updates character name
6. ✅ User sends multiple payments → Sums them correctly
7. ✅ Payment with no matching participation → Shows in unmatched list
8. ✅ Opening cycle cleans up unpaid participations
9. ✅ Manual trigger button works in admin UI
10. ✅ Match results display correctly
