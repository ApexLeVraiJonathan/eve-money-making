-- CreateTable
CREATE TABLE "public"."item_types" (
    "type_id" INTEGER NOT NULL,
    "published" BOOLEAN NOT NULL,
    "type_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_types_pkey" PRIMARY KEY ("type_id")
);
