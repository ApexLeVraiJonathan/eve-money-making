# Participation Rollover Test Suite

Comprehensive end-to-end tests for the investor automatic reinvestment (rollover) feature.

## Overview

This test suite validates all aspects of the participation rollover mechanism:
- First-time investor caps (10B)
- Rollover investor caps (20B)
- Three rollover types: FULL_PAYOUT, INITIAL_ONLY, CUSTOM_AMOUNT
- Auto-validation of rollover participations
- Opt-out functionality
- Edge cases and error handling

## Quick Start

### Prerequisites

1. **Dev/Local Environment Only** - Never run against production!
2. API server running locally
3. Dev API key or admin bearer token
4. Logistics character ID (from your database)

### Running the Full Suite

```bash
cd apps/api

pnpm exec ts-node scripts/tests/participation-rollover/participation-rollover.suite.ts \
  --apiUrl http://localhost:3000 \
  --apiKey your-dev-api-key \
  --characterId 123456 \
  --interactive
```

### Command Options

- `--apiUrl <url>` - API endpoint (default: http://localhost:3000)
- `--apiKey <key>` - Dev API key for authentication
- `--token <token>` - Bearer token (alternative to API key)
- `--characterId <id>` - Logistics character ID for creating test data
- `--testUserId <id>` - Optional: Use a real user ID for full UI verification (recommended for interactive mode)
- `--interactive` - Enable pauses for manual UI verification
- `--skip-cleanup` - Skip initial data cleanup (for debugging)

### UI Verification Modes

**Without `--testUserId`** (default):
- Uses auto-generated test user ID
- Can only verify admin-side UI (cycle lists, participation tables, etc.)
- Investor-facing UI verification is not possible

**With `--testUserId`** (recommended for thorough testing):
- Uses a real user ID that exists in your auth system
- Log in as this user to verify investor-facing UI:
  - Rollover opt-in checkboxes and options
  - "No payment needed" messages
  - Max participation cap changes (10B → 20B)
  - Opt-out functionality

Example with custom test user:
```bash
pnpm exec ts-node scripts/tests/participation-rollover/participation-rollover.suite.ts \
  --apiUrl http://localhost:3000 \
  --apiKey your-dev-api-key \
  --characterId 123456 \
  --testUserId your-auth0-user-id \
  --interactive
```

## Test Scenarios

### Scenario 01: First-Time Investor Baseline
**Tests:** 10B cap for new investors, payment matching, cycle opening

**What to verify in UI (interactive mode):**
- **[ADMIN]** Cycle 1 shows as OPEN with 10B capital
- **[ADMIN]** Test user participation displays as OPTED_IN
- **[INVESTOR]** Max participation cap shows 10B (requires --testUserId)

### Scenario 02: Full Payout Rollover - Happy Path
**Tests:** FULL_PAYOUT rollover type, auto-validation, 20B cap promotion

**What to verify in UI:**
- **[ADMIN]** Cycle 2 is PLANNED with rollover participation showing ROLLOVER memo
- **[INVESTOR]** "No payment needed" message visible for rollover participation (requires --testUserId)
- After opening: Cycle 1 is COMPLETED, Cycle 2 is OPEN
- Rollover participation shows as OPTED_IN
- User max cap now shows 20B
- Payout amount correctly split between rolled and paid amounts

### Scenario 03: Initial Only Rollover Flow
**Tests:** INITIAL_ONLY rollover type, profit payout separation

**What to verify in UI:**
- Cycle 3 is PLANNED with INITIAL_ONLY rollover type
- After opening: Only initial amount rolled over
- Profit marked for payout on previous cycle participation

### Scenario 04: Custom Amount Rollover Flow
**Tests:** CUSTOM_AMOUNT validation and surplus payout

**What to verify in UI:**
- Cycle 4 is PLANNED with custom 5B rollover amount
- After opening: Exactly 5B rolled over
- Surplus correctly marked for payout

### Scenario 05: Excess Payout Above 20B
**Tests:** 20B cap enforcement on rollovers

**What to verify in UI:**
- Rollover capped at 20B even if payout is higher
- Excess amount (> 20B) marked for payout
- Capital breakdown correct in Cycle 5

### Scenario 06: Opt-out of PLANNED Cycle
**Tests:** Opt-out functionality and restrictions

**What to verify in UI:**
- Opted-out participation shows correct status
- Cannot opt-out of OPEN cycles (error shown)

### Scenario 07: Negative Paths and Guardrails
**Tests:** Error handling, validation, edge cases

**What to verify:**
- Appropriate error messages for invalid operations
- Cap enforcement at boundaries
- Idempotency behavior

## Running Individual Scenarios

While the suite is designed to run scenarios in order (each builds on previous state), you can run Scenario 01 and 07 standalone:

```bash
# Scenario 01 (standalone)
pnpm exec ts-node scripts/tests/participation-rollover/scenarios/01-first-time-investor-baseline.test.ts \
  --apiKey your-dev-api-key \
  --characterId 123456 \
  --interactive

# Scenario 07 (standalone)
pnpm exec ts-node scripts/tests/participation-rollover/scenarios/07-negative-paths-guardrails.test.ts \
  --apiKey your-dev-api-key \
  --characterId 123456
```

Other scenarios (02-06) require previous scenario state and should only be run via the suite.

## Interactive Mode

When running with `--interactive`, the suite will pause at key checkpoints:

1. **After creating participations** - Verify UI shows correct status and memos
2. **After opening cycles** - Verify cycle transitions and rollover processing
3. **After opt-out operations** - Verify status changes

During pauses:
- Check the frontend UI at the displayed checkpoint
- Verify the listed items match expectations
- Press ENTER to continue to the next step

## Non-Interactive Mode

Without `--interactive` flag, the suite runs continuously without pauses. Use this for:
- Quick regression testing
- CI/CD pipelines (future)
- Rapid iteration during development

## Interpreting Results

### Success Output
```
✅ Scenario 01 PASSED
✅ Scenario 02 PASSED
...
✅ All scenarios PASSED - Feature ready for deployment!
```

### Failure Output
```
❌ Scenario 02 FAILED:
Error: Expected OPTED_IN, got AWAITING_INVESTMENT
⛔ Stopping suite due to critical scenario failure
```

The suite stops at the first critical failure to prevent cascading errors.

## Debugging Failed Tests

1. **Run with --skip-cleanup** to preserve state between runs
2. **Check API logs** for detailed error messages
3. **Query database directly** to inspect participation states
4. **Run individual scenarios** to isolate issues
5. **Use --interactive** to observe UI state at each step

## Helper Functions

The test suite uses reusable helper functions in `helpers/`:

- **cycle-helpers.ts** - Cycle creation and management
- **participation-helpers.ts** - Participation and rollover operations
- **transaction-helpers.ts** - Donations, sales, allocations
- **assertion-helpers.ts** - Validation and formatting

## Database State

**WARNING:** The suite DELETES ALL test data before running:
- All cycles
- All participations
- All wallet transactions and journal entries
- All allocations

This ensures a clean slate for testing. Never run against production!

## Troubleshooting

### "Cannot find module" errors
```bash
cd apps/api
pnpm install
pnpm exec ts-node --version  # Verify ts-node is available
```

### "Prisma Client not generated"
```bash
cd packages/prisma
pnpm run generate
```

### "API call failed: 401 Unauthorized"
- Verify your API key or token is correct
- Check that dev API key is enabled in your .env
- Ensure the API server is running

### "No LOGISTICS character found"
```sql
SELECT character_id, character_name, role
FROM eve_characters
WHERE role = 'LOGISTICS';
```

If no results, add a LOGISTICS character or use any character ID for testing.

## Next Steps After Suite Passes

1. Run manual QA on the frontend UI
2. Test edge cases not covered by automation
3. Verify error messages are user-friendly
4. Check analytics/metrics integration
5. Document feature for end users

## Contributing

When adding new test scenarios:
1. Follow the existing scenario naming convention
2. Update this README with the new scenario
3. Add the scenario to the suite runner
4. Include both positive and negative test cases
5. Document what to verify in interactive mode

