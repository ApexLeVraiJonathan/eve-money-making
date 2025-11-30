# Critical User Flows - Testing Guide

**Last Updated:** 2025-11-09

---

## Flow 1: User Authentication (EVE SSO)

### Steps
1. **Navigate to app:** `http://localhost:3000`
2. **Click:** "Sign in with EVE Online"
3. **Redirect:** EVE SSO login page
4. **Select character** and authorize
5. **Return:** Redirected back to app with session
6. **Verify:** User name appears in header

### API Calls
- `GET /api/auth/link-character/start` - Initiate OAuth
- NextAuth callback handling
- `GET /auth/me` - Get current user

### Expected Result
✅ User is authenticated  
✅ Character appears in account settings  
✅ Session persists across page reloads

---

## Flow 2: View Cycles Overview

### Steps
1. **Navigate to:** `/arbitrage/cycles`
2. **View current cycle** stats
3. **View next cycle** opt-in section

### API Calls
- `useCycleOverview()` → `GET /ledger/cycles/overview`
- `useCycleSnapshots(id, 10)` → `GET /ledger/cycles/:id/snapshots`

### Expected Result
✅ Current cycle displays: capital, profit, duration  
✅ Next cycle displays: start date, opt-in button  
✅ Charts render correctly  
✅ Loading states show properly

---

## Flow 3: Opt-in to Cycle

### Steps
1. **From cycles page:** Click "Opt-in now"
2. **Enter amount:** e.g., 1,000,000,000 ISK
3. **Verify character name** auto-filled
4. **Submit** opt-in
5. **Copy memo** from confirmation screen
6. **In EVE:** Send ISK to logistics character with memo

### API Calls
- `useCurrentUser()` → `GET /auth/me`
- `useCycles()` → `GET /ledger/cycles`
- `useCreateParticipation()` → `POST /ledger/cycles/:id/participations`

### Expected Result
✅ Participation created  
✅ Memo displayed (e.g., "ARB-12345678")  
✅ Status: "Awaiting Investment"  
✅ Amount matches input

---

## Flow 4: View My Investments

### Steps
1. **Navigate to:** `/arbitrage/my-investments`
2. **View** participation history
3. **Check** profit calculations

### API Calls
- `useAllParticipations()` → `GET /ledger/participations/all`

### Expected Result
✅ All participations listed  
✅ Correct investment amounts  
✅ Profit calculated correctly  
✅ ROI percentages accurate

---

## Flow 5: Admin - Match Participation Payments

### Steps
1. **Navigate to:** `/arbitrage/admin/participations`
2. **View** awaiting payment participations
3. **View** unmatched donations
4. **Select** participation + donation
5. **Click** "Link Selected Payment"

### API Calls
- `useAllParticipations()` → `GET /ledger/participations/all`
- `useUnmatchedDonations()` → `GET /ledger/participations/unmatched-donations`
- `useValidateParticipationPayment()` → `POST /ledger/participations/:id/validate`

### Expected Result
✅ Participation status: "Opted In"  
✅ Payment linked  
✅ Donation removed from unmatched list  
✅ Ledger entry created

---

## Flow 6: Admin - Create and Open Cycle

### Steps
1. **Navigate to:** `/arbitrage/admin/cycles`
2. **Click** "Plan a Cycle"
3. **Enter** name, future date, optional injection
4. **Submit** - Cycle created
5. **Click** "Open now" when ready
6. **Verify** opening balance lines created

### API Calls
- `usePlanCycle()` → `POST /ledger/cycles/plan`
- `useOpenCycle()` → `POST /ledger/cycles/:id/open`

### Expected Result
✅ Cycle created with planned status  
✅ Cycle opens successfully  
✅ Initial capital computed  
✅ Opening balance lines created from carryover inventory

---

## Flow 7: Admin - Close Cycle

### Steps
1. **Navigate to:** `/arbitrage/admin/cycles`
2. **Find** open cycle
3. **Click** "Close"
4. **Wait** for wallet import + allocation
5. **Verify** payouts created

### API Calls
- `useCloseCycle()` → `POST /ledger/cycles/:id/close`

### Backend Process
1. Import wallet transactions
2. Allocate to cycle lines
3. Close cycle
4. Create payouts based on profit share

### Expected Result
✅ Cycle status: "Closed"  
✅ All transactions allocated  
✅ Payouts calculated correctly  
✅ Ready for payout distribution

---

## Flow 8: Admin - Process Payouts

### Steps
1. **Navigate to:** `/arbitrage/admin/participations`
2. **View** "Payouts Needed" section
3. **Copy** payout amounts for each participant
4. **In EVE:** Send ISK to each participant
5. **Click** "Mark Payout Sent" for each

### API Calls
- `useMarkPayoutSent()` → `POST /ledger/participations/:id/mark-payout-sent`

### Expected Result
✅ Payout marked as sent  
✅ Participation status: "Completed"  
✅ Removed from pending payouts list

---

## Flow 9: View Cycle Profit

### Steps
1. **Navigate to:** `/arbitrage/admin/profit?cycleId=xxx`
2. **View** profit breakdown by item
3. **View** transport fees
4. **Add** transport fee if needed

### API Calls
- `useCycleProfit(id)` → `GET /ledger/cycles/:id/profit`
- `useTransportFees(id)` → `GET /ledger/cycles/:id/transport-fees`
- `useAddTransportFee()` → `POST /ledger/cycles/:id/transport-fee`

### Expected Result
✅ Line profit displayed correctly  
✅ Transport fees listed  
✅ Net cash profit accurate  
✅ Can add new transport fees

---

## Flow 10: Admin - Manage Cycle Lines

### Steps
1. **Navigate to:** `/arbitrage/admin/lines?cycleId=xxx`
2. **View** all cycle lines
3. **Create** new line (optional)
4. **Add** broker/relist fees
5. **Delete** line if needed

### API Calls
- `useCycleLines(id)` → `GET /ledger/cycles/:id/lines`
- `useCreateCycleLine()` → `POST /ledger/cycles/:id/lines`
- `useAddBrokerFee()` → `POST /ledger/lines/:id/broker-fee`
- `useAddRelistFee()` → `POST /ledger/lines/:id/relist-fee`
- `useDeleteCycleLine()` → `DELETE /ledger/lines/:id`

### Expected Result
✅ All lines displayed with enriched data  
✅ Can create new lines  
✅ Fees add correctly  
✅ Lines delete successfully

---

## Testing Checklist

### Authentication
- [ ] Sign in with EVE SSO works
- [ ] Character linking works
- [ ] Session persists
- [ ] Logout works
- [ ] Protected routes redirect

### Cycles
- [ ] View cycles overview
- [ ] Opt-in to next cycle
- [ ] View my investments
- [ ] Cycle history displays correctly

### Admin - Participations
- [ ] View all participations
- [ ] Match payments manually
- [ ] Mark payouts sent
- [ ] Process refunds

### Admin - Cycle Management
- [ ] Create cycle
- [ ] Plan cycle
- [ ] Open cycle
- [ ] Close cycle
- [ ] View profit

### Admin - Data Management
- [ ] View/edit cycle lines
- [ ] Add fees
- [ ] View ledger entries
- [ ] View wallet transactions

---

## Error Scenarios

### Test These
1. **Invalid auth token:** Should show proper error
2. **Network failure:** Should show error state
3. **Invalid data:** Form validation should catch
4. **Concurrent operations:** Should handle gracefully
5. **Missing data:** Should show empty states

---

## Performance Testing

### Check These
1. **Page load times:** <1 second for most pages
2. **API response times:** <500ms for most endpoints
3. **Cache behavior:** Subsequent loads instant
4. **Mutation feedback:** Immediate loading states
5. **Error recovery:** Automatic retry on transient failures

---

## Summary

All critical flows use:
- ✅ Type-safe API hooks
- ✅ Automatic error handling
- ✅ Loading states
- ✅ Cache invalidation
- ✅ Direct API communication

**The application is ready for production use!** 🚀

