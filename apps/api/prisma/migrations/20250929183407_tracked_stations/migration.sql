-- CreateTable
CREATE TABLE "public"."tracked_stations" (
    "id" TEXT NOT NULL,
    "station_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracked_stations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tracked_stations_station_id_idx" ON "public"."tracked_stations"("station_id");

-- AddForeignKey
ALTER TABLE "public"."tracked_stations" ADD CONSTRAINT "tracked_stations_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("station_id") ON DELETE RESTRICT ON UPDATE CASCADE;
