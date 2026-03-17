/*
  Warnings:

  - Added the required column `base_id` to the `products` table without a default value. This is not possible if the table is not empty.

*/
-- Add column nullable first, backfill, then set NOT NULL
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "base_id" TEXT;
UPDATE "products" SET "base_id" = "id" WHERE "base_id" IS NULL;
ALTER TABLE "products" ALTER COLUMN "base_id" SET NOT NULL;
