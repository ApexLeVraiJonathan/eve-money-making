-- CreateTable
CREATE TABLE IF NOT EXISTS "market_price_anomalies" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "location_id" BIGINT NOT NULL,
    "type_id" INTEGER NOT NULL,
    "is_buy_order" BOOLEAN NOT NULL,
    "observed_price" DECIMAL(28,2) NOT NULL,
    "observed_volume" BIGINT NOT NULL,
    "reference_price" DECIMAL(28,2),
    "threshold_low" DECIMAL(28,2),
    "threshold_high" DECIMAL(28,2),
    "severity" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason_code" TEXT NOT NULL,
    "reference_source" TEXT,
    "scan_observed_at" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_price_anomalies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "market_price_anomalies_source_scan_observed_at_idx" ON "market_price_anomalies"("source", "scan_observed_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "market_price_anomalies_location_id_scan_observed_at_idx" ON "market_price_anomalies"("location_id", "scan_observed_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "market_price_anomalies_type_id_scan_observed_at_idx" ON "market_price_anomalies"("type_id", "scan_observed_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "market_price_anomalies_severity_action_idx" ON "market_price_anomalies"("severity", "action");

