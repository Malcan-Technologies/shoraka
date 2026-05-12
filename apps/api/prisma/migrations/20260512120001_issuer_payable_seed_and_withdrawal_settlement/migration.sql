-- Seed the platform-wide Issuer Payable ledger account
INSERT INTO "note_ledger_accounts" ("id", "code", "name", "type", "updated_at") VALUES
  ('note_account_issuer_payable', 'ISSUER_PAYABLE', 'Issuer Payable', 'ISSUER_PAYABLE', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- Link withdrawal instructions to the settlement that produced them and add a completion timestamp
ALTER TABLE "withdrawal_instructions"
  ADD COLUMN "settlement_id" TEXT,
  ADD COLUMN "completed_at" TIMESTAMP(3);

CREATE INDEX "withdrawal_instructions_settlement_id_idx" ON "withdrawal_instructions"("settlement_id");

ALTER TABLE "withdrawal_instructions"
  ADD CONSTRAINT "withdrawal_instructions_settlement_id_fkey"
    FOREIGN KEY ("settlement_id") REFERENCES "note_settlements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
