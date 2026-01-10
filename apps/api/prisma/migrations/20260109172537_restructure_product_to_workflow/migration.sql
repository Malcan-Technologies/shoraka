/*
  Warnings:

  - You are about to drop the column `declarations` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `image_url` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `max_financing_percent` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `max_profit_rate` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `min_profit_rate` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `required_documents` on the `products` table. All the data in the column will be lost.
  - Added the required column `workflow` to the `products` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "products" DROP COLUMN "declarations",
DROP COLUMN "description",
DROP COLUMN "image_url",
DROP COLUMN "max_financing_percent",
DROP COLUMN "max_profit_rate",
DROP COLUMN "min_profit_rate",
DROP COLUMN "name",
DROP COLUMN "required_documents",
ADD COLUMN     "workflow" JSONB NOT NULL;

