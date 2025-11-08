-- CreateTable
CREATE TABLE "public"."market_order_trades_daily" (
    "scan_date" DATE NOT NULL,
    "location_id" INTEGER NOT NULL,
    "type_id" INTEGER NOT NULL,
    "is_buy_order" BOOLEAN NOT NULL,
    "region_id" INTEGER NOT NULL,
    "has_gone" BOOLEAN NOT NULL,
    "amount" INTEGER NOT NULL,
    "high" DECIMAL(65,30) NOT NULL,
    "low" DECIMAL(65,30) NOT NULL,
    "avg" DECIMAL(65,30) NOT NULL,
    "order_num" INTEGER NOT NULL,
    "isk_value" DECIMAL(65,30) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_order_trades_daily_pkey" PRIMARY KEY ("scan_date","location_id","type_id","is_buy_order")
);

-- CreateIndex
CREATE INDEX "market_order_trades_daily_region_id_idx" ON "public"."market_order_trades_daily"("region_id");

-- CreateIndex
CREATE INDEX "market_order_trades_daily_location_id_idx" ON "public"."market_order_trades_daily"("location_id");

-- CreateIndex
CREATE INDEX "market_order_trades_daily_type_id_idx" ON "public"."market_order_trades_daily"("type_id");

-- AddForeignKey
ALTER TABLE "public"."market_order_trades_daily" ADD CONSTRAINT "market_order_trades_daily_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("region_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."market_order_trades_daily" ADD CONSTRAINT "market_order_trades_daily_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "public"."item_types"("type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."market_order_trades_daily" ADD CONSTRAINT "market_order_trades_daily_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."stations"("station_id") ON DELETE RESTRICT ON UPDATE CASCADE;
