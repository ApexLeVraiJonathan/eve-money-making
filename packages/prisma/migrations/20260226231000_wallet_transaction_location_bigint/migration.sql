-- Wallet transaction location IDs can be structure IDs (> int4 range).
-- Store them as bigint to prevent overflow on import.
ALTER TABLE "wallet_transactions"
ALTER COLUMN "location_id" TYPE BIGINT;
