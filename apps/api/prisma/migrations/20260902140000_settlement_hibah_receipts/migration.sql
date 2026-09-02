-- Issuer-copy Settlement & Hibah Receipt artefacts (one V01 PDF per posted settlement).

CREATE TYPE "SettlementHibahReceiptStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

CREATE TABLE "settlement_hibah_receipts" (
    "id" TEXT NOT NULL,
    "note_id" TEXT NOT NULL,
    "settlement_id" TEXT NOT NULL,
    "receipt_number" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" "SettlementHibahReceiptStatus" NOT NULL DEFAULT 'PENDING',
    "snapshot" JSONB NOT NULL,
    "pdf_s3_key" TEXT,
    "pdf_sha256" TEXT,
    "generated_at" TIMESTAMP(3),
    "generation_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settlement_hibah_receipts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "settlement_hibah_receipts_settlement_version_uidx" ON "settlement_hibah_receipts"("settlement_id", "version");

CREATE INDEX "settlement_hibah_receipts_note_id_version_idx" ON "settlement_hibah_receipts"("note_id", "version");

CREATE INDEX "settlement_hibah_receipts_status_idx" ON "settlement_hibah_receipts"("status");

CREATE INDEX "settlement_hibah_receipts_receipt_number_idx" ON "settlement_hibah_receipts"("receipt_number");

ALTER TABLE "settlement_hibah_receipts" ADD CONSTRAINT "settlement_hibah_receipts_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "settlement_hibah_receipts" ADD CONSTRAINT "settlement_hibah_receipts_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "note_settlements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
