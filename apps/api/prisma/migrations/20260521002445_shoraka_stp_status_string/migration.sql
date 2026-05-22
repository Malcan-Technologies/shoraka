/*
  Warnings:

  - The `status` column on the `shoraka_trade_orders` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "shoraka_trade_orders" DROP COLUMN "status",
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING_SUBMISSION';

-- DropEnum
DROP TYPE "ShorakaTradeOrderStatus";
