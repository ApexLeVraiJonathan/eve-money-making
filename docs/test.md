🧪 Test Checklist - Participation Management Features
Prerequisites Setup
[ x] At least 1 LOGISTICS character linked (e.g., LeVraiTrader)
[ x] 1 planned cycle exists (created via Admin → Cycles)
[x ] User character linked for testing opt-in flow
1️⃣ User Flow - Opt-In
Location: /arbitrage/cycles
[ x] See planned cycle in "Next Cycle" section
[ x] "Opt-in now" button is visible
[ x] Click "Opt-in now" → Dialog opens with cycle details
[x ] Enter ISK amount (try preset buttons: 100M, 500M, 1B, 5B)
[x ] Amount formats with commas as you type
[ x] Click "Confirm Opt-in" → Success message shows
[ x] See memo instructions with character name and steps
[x ] Close dialog → "Next Cycle" now shows participation status
[ x] Verify status badge shows "Awaiting Investment"
[ x] Copy memo from UI
2️⃣ User Flow - Opt-Out (Before Payment)
Location: /arbitrage/cycles
[x ] While status is "Awaiting Investment", see "Cancel Participation" button
[x ] Click "Cancel Participation" → Confirmation dialog appears
[ x] Confirm → Participation cancelled without refund
[x ] "Opt-in now" button reappears
3️⃣ Admin Flow - Wallet Import
Location: /arbitrage/admin/triggers → Participations tab
[x ] See "Wallet Journal Import" card
[ x] Click "Import Wallet Journals" button
[x ] Toast shows "Importing wallet journals..."
[x ] After completion, toast shows success with count (or error if failed)
4️⃣ Admin Flow - Automated Payment Matching
Location: /arbitrage/admin/triggers → Participations tab
[ x] See "Match Participation Payments" card
[x ] Click "Match Payments" button
[ ] Results appear below button showing:
✅ Matched: Fully paid participations
⚠️ Partial/Updated: Overpaid or additional payments
❌ Unmatched: Donations that couldn't be linked
[ ] Check console for detailed matching results
5️⃣ Admin Flow - Manual Payment Matching
Location: /arbitrage/admin/participations
[ ] See "Manual Payment Matching" section at top
[ ] Left side: "Awaiting Payment" list (should show opt-ins without payment)
[ ] Right side: "Unmatched Donations" list (donations without matched participation)
[ ] Click a participation on left → Highlights
[ ] Click a donation on right → Highlights
[ ] Click "Link Selected Payment" → Confirmation dialog
[ ] Confirm → Participation status updates to "Opted In"
[ ] Lists refresh automatically
6️⃣ Admin Flow - Refunds
Location: /arbitrage/admin/participations
Setup: User opts out AFTER payment
[ ] User opts in and pays (manually via ESI or mock)
[ ] Admin imports wallet and matches payment
[ ] User clicks "Cancel Participation" → Refund requested
Test:
[ ] See participation in "Refunds Needed" section
[ ] Shows character name, amount, cycle, cancelled date
[ ] Click "Mark Refund Sent" → Confirmation prompt
[ ] Confirm → Status updates to "Refunded"
[ ] Entry disappears from refunds list
[ ] Withdrawal ledger entry created (check DB/logs)
7️⃣ Admin Flow - Payouts
Location: /arbitrage/admin/participations
Setup: Cycle completes with profit/loss
[ ] Admin closes cycle via Admin → Cycles → Details
[ ] System calculates payouts (50% profit share)
Test:
[ ] See participations in "Payouts Needed" section
[ ] Shows character name, investment, payout amount, cycle
[ ] Payout amount correctly calculated (investment + share of profit)
[ ] Click "Mark Payout Sent" → Confirmation prompt
[ ] Confirm → Status updates
[ ] Entry disappears from payouts list
8️⃣ Edge Cases
[ ] Opt-out after cycle starts: Button should not allow (verify error message)
[ ] Double payment: Import wallet twice → Should sum amounts
[ ] Wrong memo: Fuzzy matching catches typos (e.g., "ABR" instead of "ARB")
[ ] Wrong character pays: System links to actual payer character
[ ] No payment by cycle start: Participation auto-deleted when cycle opens
9️⃣ Empty States
Location: /arbitrage/admin/participations
[ ] With no pending refunds → See "No refunds needed" empty state
[ ] With no pending payouts → See "No payouts pending" empty state
[ ] Both sections always visible with appropriate messaging
🎯 Full Lifecycle Test
End-to-End Happy Path:
✅ User opts in → Status: Awaiting Investment
💸 User sends ISK in-game with memo
🔄 Admin imports wallet journals
🔗 System auto-matches payment → Status: Opted In
🚀 Admin opens cycle → Unpaid participations cleaned up
📊 Admin closes cycle with profit
💰 System calculates payouts
✉️ Admin marks payout as sent
✅ Cycle complete!
Let me know which part you'd like to test first! 🚀
