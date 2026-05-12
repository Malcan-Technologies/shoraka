-- Add ISSUER_DISBURSEMENT to WithdrawalType so the initial issuer payout (post funding close) can be tracked
-- alongside investor and residual withdrawals.
ALTER TYPE "WithdrawalType" ADD VALUE 'ISSUER_DISBURSEMENT';
