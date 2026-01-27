-- Fix MarketOrderTradeDaily PK to include has_gone.
-- Previously, has_gone was not part of the PK, causing one mode to be dropped.

ALTER TABLE "public"."market_order_trades_daily"
  DROP CONSTRAINT IF EXISTS "market_order_trades_daily_pkey";

ALTER TABLE "public"."market_order_trades_daily"
  ADD CONSTRAINT "market_order_trades_daily_pkey"
  PRIMARY KEY ("scan_date", "location_id", "type_id", "is_buy_order", "has_gone");

