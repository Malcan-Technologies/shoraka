-- Add ISSUER_PAYABLE ledger account type (must be alone: Postgres commits enum values before use in a later migration)
ALTER TYPE "NoteLedgerAccountType" ADD VALUE 'ISSUER_PAYABLE';
