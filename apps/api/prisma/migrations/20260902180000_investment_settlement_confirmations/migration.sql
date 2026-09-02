-- Investor-copy Investment Settlement Confirmation artefacts
-- (one V01 PDF per posted settlement and investor organization).

CREATE TYPE "InvestmentSettlementConfirmationStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

CREATE TABLE "investment_settlement_confirmations" (
    "id" TEXT NOT NULL,
    "note_id" TEXT NOT NULL,
    "settlement_id" TEXT NOT NULL,
    "investor_organization_id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" "InvestmentSettlementConfirmationStatus" NOT NULL DEFAULT 'PENDING',
    "snapshot" JSONB NOT NULL,
    "pdf_s3_key" TEXT,
    "pdf_sha256" TEXT,
    "generated_at" TIMESTAMP(3),
    "generation_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investment_settlement_confirmations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "investment_settlement_confirmations_scope_uidx" ON "investment_settlement_confirmations"("settlement_id", "investor_organization_id", "version");

CREATE INDEX "investment_settlement_confirmations_note_id_version_idx" ON "investment_settlement_confirmations"("note_id", "version");

CREATE INDEX "investment_settlement_confirmations_investor_organization_id_idx" ON "investment_settlement_confirmations"("investor_organization_id");

CREATE INDEX "investment_settlement_confirmations_status_idx" ON "investment_settlement_confirmations"("status");

ALTER TABLE "investment_settlement_confirmations" ADD CONSTRAINT "investment_settlement_confirmations_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "investment_settlement_confirmations" ADD CONSTRAINT "investment_settlement_confirmations_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "note_settlements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "investment_settlement_confirmations" ADD CONSTRAINT "investment_settlement_confirmations_investor_organization_id_fkey" FOREIGN KEY ("investor_organization_id") REFERENCES "investor_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
