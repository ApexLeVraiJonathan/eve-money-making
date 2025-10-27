-- CreateTable
CREATE TABLE "public"."committed_packages" (
    "id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "package_index" INTEGER NOT NULL,
    "destination_station_id" INTEGER NOT NULL,
    "destination_name" TEXT,
    "collateral_isk" DECIMAL(28,2) NOT NULL,
    "shipping_cost_isk" DECIMAL(28,2) NOT NULL,
    "estimated_profit_isk" DECIMAL(28,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "committed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failed_at" TIMESTAMP(3),
    "collateral_recovered_isk" DECIMAL(28,2),
    "failure_memo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "committed_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."committed_package_items" (
    "id" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "type_id" INTEGER NOT NULL,
    "type_name" TEXT NOT NULL,
    "units" INTEGER NOT NULL,
    "unit_cost" DECIMAL(28,2) NOT NULL,
    "unit_profit" DECIMAL(28,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "committed_package_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."package_cycle_lines" (
    "id" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "cycle_line_id" TEXT NOT NULL,
    "units_committed" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "package_cycle_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "committed_packages_cycle_id_idx" ON "public"."committed_packages"("cycle_id");

-- CreateIndex
CREATE INDEX "committed_packages_status_idx" ON "public"."committed_packages"("status");

-- CreateIndex
CREATE INDEX "committed_package_items_package_id_idx" ON "public"."committed_package_items"("package_id");

-- CreateIndex
CREATE INDEX "committed_package_items_package_id_type_id_idx" ON "public"."committed_package_items"("package_id", "type_id");

-- CreateIndex
CREATE INDEX "package_cycle_lines_package_id_idx" ON "public"."package_cycle_lines"("package_id");

-- CreateIndex
CREATE INDEX "package_cycle_lines_cycle_line_id_idx" ON "public"."package_cycle_lines"("cycle_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "package_cycle_lines_package_id_cycle_line_id_key" ON "public"."package_cycle_lines"("package_id", "cycle_line_id");

-- AddForeignKey
ALTER TABLE "public"."committed_packages" ADD CONSTRAINT "committed_packages_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."committed_package_items" ADD CONSTRAINT "committed_package_items_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."committed_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."package_cycle_lines" ADD CONSTRAINT "package_cycle_lines_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."committed_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."package_cycle_lines" ADD CONSTRAINT "package_cycle_lines_cycle_line_id_fkey" FOREIGN KEY ("cycle_line_id") REFERENCES "public"."cycle_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
