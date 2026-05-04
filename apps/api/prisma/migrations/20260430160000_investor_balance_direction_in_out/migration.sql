-- Rename direction labels: pool-centric IN/OUT instead of CREDIT/DEBIT
ALTER TYPE "InvestorBalanceTransactionDirection" RENAME VALUE 'CREDIT' TO 'IN';
ALTER TYPE "InvestorBalanceTransactionDirection" RENAME VALUE 'DEBIT' TO 'OUT';
