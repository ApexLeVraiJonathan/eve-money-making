# Undercut-Checker Guide

## Overview

The Undercut-Checker helps you efficiently manage repricing of active sell orders by identifying orders that have been undercut by competitors and suggesting optimal repricing strategies.

## Key Features

### 1. Grouping Modes

Control how orders are grouped and displayed to reduce noise and save time:

- **Per Order** (default legacy behavior): Shows all individual orders for each item
- **Per Character** (recommended): Shows only the primary order (highest volume) per character/item/station combination
- **Global**: Shows only one order per item/station across all characters (highest volume globally)

**Why use grouping?**
If you have multiple orders for the same item at the same station (e.g., two partial stacks), repricing both wastes time and ISK on relist fees. The system picks the order with the most remaining volume as the "primary" order to reprice, ignoring the others.

**How to use:**
- Select your preferred mode in the "Grouping Mode" dropdown in the Configuration card
- Default is "Per Character" for optimal balance between control and efficiency

### 2. Volume-Based Undercut Filtering

The system intelligently filters out repricing suggestions when competitor volume is too small to matter.

**How it works:**
- For each order, the system calculates cumulative competitor volume at prices below yours
- Only suggests repricing when competitor volume reaches a threshold (default: 15% of your order's original volume)
- Absolute minimum: at least 1 unit must be undercutting you

**Example:**
- You have 100 units listed (original order size: 200/200, now 100/200 remaining)
- Competitor A has 1 unit listed 20% cheaper
- Competitor B has 50 units listed 0.1% cheaper
- System calculates: 15% of 200 = 30 units threshold
- Only Competitor B's 50 units exceed the threshold, so suggested price targets their level
- Competitor A's single unit is ignored

**Configuration:**
- Backend default: `minUndercutVolumeRatio = 0.15` (15%)
- Can be adjusted via API parameters `minUndercutVolumeRatio` and `minUndercutUnits`
- Threshold is compared against the order's **original volume** (`volume_total`), not remaining volume

### 3. Profitability Warnings

When using cycle mode, the system calculates profitability for each suggested reprice.

**Visual Indicators:**
- ⚠️ **Warning icon**: Appears in the warning column for loss-making reprices
- **Red background**: Loss-making rows have a light red tint
- **Tooltip**: Hover over any row to see margin % and estimated profit after reprice

**Auto-Deselection:**
- Loss-making reprices are automatically deselected by default
- You must explicitly check them to confirm those reprices
- This prevents accidentally selling at a loss

**How it calculates:**
- Uses cycle line data to determine your unit cost (buy price)
- Applies configured sales tax (default: 3.37%) and broker fees (default: 1.5%)
- Computes net profit per unit after fees
- Calculates total profit: `(net sell price - unit cost) * remaining units`
- Flags as loss if profit < 0

### 4. Copy Price Shortcut

Speed up manual repricing with one-click price copying.

**How to use:**
1. Run the undercut check
2. In the results table, find the "Suggested" column
3. Click the copy icon (📋) next to any suggested price
4. Icon changes to checkmark (✓) for 2 seconds to confirm
5. Alt+Tab to EVE, right-click your order → Modify → Ctrl+V → Confirm
6. Repeat for next item

**Keyboard accessible:**
- Copy button is focusable via Tab key
- Press Enter or Space to trigger copy

## Workflow Example

**Before improvements (300 orders, ~45 minutes):**
1. Run check → 300 rows displayed (including duplicate orders for same items)
2. Manually evaluate each row to decide if undercut is significant
3. Copy-paste suggested price 300 times
4. Some reprices result in losses due to market changes

**After improvements (same 300 orders, ~15-20 minutes):**
1. Set grouping mode to "Per Character" → ~150 rows (only primary orders)
2. Volume filtering auto-removes ~50 insignificant undercuts → ~100 rows
3. Loss warnings auto-deselect ~10 unprofitable items → ~90 actionable rows
4. One-click copy for each row speeds up paste workflow
5. Total: **~90 reprices instead of 300, with better decisions**

## Configuration Options

### Frontend (Undercut-Checker Page)

- **Use latest open cycle**: Auto-selects current cycle for profitability calculations
- **Grouping Mode**: Select Per Order / Per Character / Global
- **Cycle ID**: Manual cycle ID input (when not using auto-selection)

### Backend Parameters (API)

Available via `/pricing/undercut-check` endpoint:

```typescript
{
  characterIds?: number[];           // Filter to specific characters
  stationIds?: number[];             // Filter to specific stations
  cycleId?: string;                  // Enable profitability calculations
  groupingMode?: "perOrder" | "perCharacter" | "global";
  minUndercutVolumeRatio?: number;   // Default: 0.15 (15%)
  minUndercutUnits?: number;         // Default: 1
}
```

## Response Fields

Each update item in the response includes:

```typescript
{
  orderId: number;
  typeId: number;
  itemName: string;
  remaining: number;
  currentPrice: number;
  competitorLowest: number;
  suggestedNewPriceTicked: number;
  
  // Optional profitability fields (when cycleId provided)
  estimatedMarginPercentAfter?: number;  // e.g., 12.5 = 12.5% margin
  estimatedProfitIskAfter?: number;      // Total ISK profit after reprice
  wouldBeLossAfter?: boolean;            // true if margin < 0
}
```

## Tips & Best Practices

1. **Use "Per Character" grouping** for daily repricing (balances efficiency and control)
2. **Use "Global" grouping** when you have multiple characters selling the same items and want absolute minimal clicks
3. **Review loss warnings carefully** - sometimes selling at a small loss is strategically correct (clearing inventory, market trends)
4. **Adjust volume threshold** if you want more/fewer suggestions:
   - Lower threshold (e.g., 10%) = more sensitive to small undercuts
   - Higher threshold (e.g., 20%) = only reprice for significant competition
5. **Run checks 2-3 times per day** for high-competition items
6. **Use keyboard shortcuts** - Tab through copy buttons, Enter to copy, Alt+Tab to EVE

## Troubleshooting

**Too many repricing suggestions:**
- Increase `minUndercutVolumeRatio` to filter out smaller undercuts
- Use "Per Character" or "Global" grouping mode

**Not enough suggestions (missing expected undercuts):**
- Check if orders are part of the selected cycle (when using cycle mode)
- Verify volume threshold isn't too high
- Try "Per Order" mode to see all individual orders

**Profitability data not showing:**
- Ensure you're using cycle mode ("Use latest open cycle" checked)
- Verify orders are associated with cycle lines
- Check that cycle lines have valid cost data

**Copy button not working:**
- Ensure browser allows clipboard access
- Try clicking directly (don't use right-click → copy)
- Check browser console for errors

## Technical Details

### Volume Threshold Logic

```typescript
// For each order
const volumeThreshold = Math.max(
  minUndercutVolumeRatio * order.volume_total,  // e.g., 0.15 * 200 = 30
  minUndercutUnits  // e.g., 1
);

// Accumulate competitor volume below our price
let cumulativeCompetitorVolume = 0;
for (const competitorOrder of sortedCompetitorOrders) {
  if (competitorOrder.price >= ourOrder.price) break;
  cumulativeCompetitorVolume += competitorOrder.volume;
  
  if (cumulativeCompetitorVolume >= volumeThreshold) {
    // This price level has enough volume to matter
    targetCompetitorPrice = competitorOrder.price;
    break;
  }
}
```

### Profitability Calculation

```typescript
const feePercent = salesTaxPercent + brokerFeePercent;  // e.g., 3.37 + 1.5 = 4.87%
const effectiveSellPrice = suggestedPrice * (1 - feePercent / 100);
const profitPerUnit = effectiveSellPrice - unitCost;
const marginPercent = (profitPerUnit / unitCost) * 100;
const totalProfit = profitPerUnit * remaining;
const wouldBeLoss = totalProfit < 0;
```

## Future Enhancements

Potential improvements under consideration:

- Configurable volume thresholds in UI (currently backend-only)
- Bulk reprice suggestions export to CSV
- Historical reprice tracking and effectiveness metrics
- Integration with EVE client for automated repricing (EULA-compliant approaches only)
- Smart repricing schedules based on market activity patterns

