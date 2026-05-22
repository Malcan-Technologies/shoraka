-- AlterTable
ALTER TABLE "shoraka_trade_orders" ADD COLUMN     "callback_payload" JSONB,
ADD COLUMN     "callback_received_at" TIMESTAMP(3);
