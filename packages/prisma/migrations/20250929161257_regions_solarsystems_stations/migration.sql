-- CreateTable
CREATE TABLE "public"."regions" (
    "region_id" INTEGER NOT NULL,
    "region_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("region_id")
);

-- CreateTable
CREATE TABLE "public"."solar_systems" (
    "solar_system_id" INTEGER NOT NULL,
    "region_id" INTEGER NOT NULL,
    "solar_system_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solar_systems_pkey" PRIMARY KEY ("solar_system_id")
);

-- CreateTable
CREATE TABLE "public"."stations" (
    "station_id" INTEGER NOT NULL,
    "solar_system_id" INTEGER NOT NULL,
    "station_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stations_pkey" PRIMARY KEY ("station_id")
);

-- CreateIndex
CREATE INDEX "solar_systems_region_id_idx" ON "public"."solar_systems"("region_id");

-- CreateIndex
CREATE INDEX "stations_solar_system_id_idx" ON "public"."stations"("solar_system_id");

-- AddForeignKey
ALTER TABLE "public"."solar_systems" ADD CONSTRAINT "solar_systems_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("region_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stations" ADD CONSTRAINT "stations_solar_system_id_fkey" FOREIGN KEY ("solar_system_id") REFERENCES "public"."solar_systems"("solar_system_id") ON DELETE RESTRICT ON UPDATE CASCADE;
