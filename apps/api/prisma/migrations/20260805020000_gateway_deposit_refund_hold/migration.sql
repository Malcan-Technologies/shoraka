-- Temporary hold + permanent refund OUT sources for gateway deposit wallet reversal.
ALTER TYPE "InvestorBalanceTransactionSource" ADD VALUE IF NOT EXISTS 'GATEWAY_DEPOSIT_REFUND';
ALTER TYPE "InvestorBalanceTransactionSource" ADD VALUE IF NOT EXISTS 'GATEWAY_DEPOSIT_REFUND_HOLD';
