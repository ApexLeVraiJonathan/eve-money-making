# Plan Restore Guide

This guide explains how to restore your lost plan from the `plan.md` file.

## ✅ Fixed Issues

1. **404 Error** - Fixed incorrect API endpoint
   - Changed from `/tradecraft/commit` to `/arbitrage/commit`
2. **400 Error** - Fixed validation issue  
   - Added `@Allow()` decorator to DTO properties
3. **Database** - Cleaned dev database to prepare for restore

## 🚀 Quick Start

### Option 1: Automatic Restore (Recommended)

This option will automatically commit the plan via the API.

```bash
# Step 1: Create an open cycle (if you don't have one)
cd apps/api
npx ts-node scripts/create-open-cycle.ts --apiKey YOUR_DEV_API_KEY

# Step 2: Restore the plan
npx ts-node scripts/restore-plan-from-file.ts \
  --file ../../docs/plan.md \
  --apiKey YOUR_DEV_API_KEY \
  --memo "Restored plan from production incident"
```

### Option 2: Manual via Swagger UI

This option generates JSON that you can paste into Swagger.

```bash
# Step 1: Generate the JSON
cd apps/api
npx ts-node scripts/generate-plan-json.ts \
  --file ../../docs/plan.md \
  --output plan-payload.json

# Step 2: Copy the JSON from plan-payload.json

# Step 3: Go to http://localhost:3000/docs

# Step 4: Find POST /arbitrage/commit endpoint

# Step 5: Paste the JSON and execute
```

## 📊 What the Scripts Do

### `create-open-cycle.ts`
- Creates a new cycle
- Opens it for trading
- Required before committing any plan

### `restore-plan-from-file.ts`
- Parses `plan.md` file
- Looks up typeIds and volumes from database
- Converts to proper `PlanResult` format
- Commits to the API endpoint

### `generate-plan-json.ts`
- Same as above, but just outputs JSON
- Useful if you want to inspect/modify before committing
- Or if you prefer using Swagger UI

## 📝 Plan File Format

Your `plan.md` file is structured as:

```
## Station Name

Item Name Quantity
Item Name Quantity

---

Item Name Quantity
...
```

- `##` indicates a new destination station
- `---` separates packages going to the same station
- Each line is: `Item Name [space] Quantity`

## 🔧 Troubleshooting

### "No open cycle found"
Run `create-open-cycle.ts` first to create one.

### "Could not find typeId for: X"
The item name in your plan.md doesn't match the database. Check the item name spelling.

### "Unknown station: X"
Add the station to the `STATION_MAP` in the scripts:

```typescript
const STATION_MAP: Record<string, number> = {
  'Your Station Name': 12345678,
  // ...
};
```

## 📦 Your Plan Summary

From `plan.md`:
- **3 destination stations**:
  - Rens VI - Moon 8 - Brutor Tribe Treasury (ID: 60004588)
  - Hek VIII - Moon 12 - Boundless Creation Factory (ID: 60005686)
  - Amarr VIII (Oris) - Emperor Family Academy (ID: 60008494)
- **~70 packages total**
- **Hundreds of different items**

## ⚠️ Important Notes

1. **Placeholder Pricing**: The scripts use placeholder values for `unitCost` and `unitProfit` since we don't have the original plan data. These are just to satisfy the API structure - the actual buy/sell prices will be determined when you execute the trades.

2. **Volumes Are Real**: The scripts fetch actual item volumes from the database, so package volumes will be accurate.

3. **Dev Environment**: Make sure you're running this against your **dev** database, not production!

## 🎯 Next Steps After Restore

Once the plan is committed:

1. Go to `/tradecraft/admin/cycles` to view the cycle
2. Go to `/tradecraft/admin/packages` to see the committed packages
3. Review the cycle lines to verify everything looks correct
4. You can now proceed with your trading operations

## 💡 Future Prevention

Consider:
- Adding a "Save Plan" button that exports to JSON
- Auto-saving plans to local storage
- Adding plan versioning in the database

