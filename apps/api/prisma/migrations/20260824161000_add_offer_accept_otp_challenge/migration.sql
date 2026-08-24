-- CreateEnum
CREATE TYPE "OfferAcceptSignatorySource" AS ENUM ('FACILITY_ENVELOPE', 'ORG_DIRECTOR');

-- CreateTable
CREATE TABLE "offer_accept_otp_challenges" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "requested_by_user_id" VARCHAR(5) NOT NULL,
    "signatory_name" TEXT NOT NULL,
    "signatory_email" TEXT NOT NULL,
    "signatory_source" "OfferAcceptSignatorySource" NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumed_at" TIMESTAMP(3),
    "resend_count" INTEGER NOT NULL DEFAULT 0,
    "last_sent_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offer_accept_otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "offer_accept_otp_challenges_application_id_idx" ON "offer_accept_otp_challenges"("application_id");

-- CreateIndex
CREATE INDEX "offer_accept_otp_challenges_invoice_id_idx" ON "offer_accept_otp_challenges"("invoice_id");

-- CreateIndex
CREATE INDEX "offer_accept_otp_challenges_contract_id_idx" ON "offer_accept_otp_challenges"("contract_id");

-- CreateIndex
CREATE INDEX "offer_accept_otp_challenges_invoice_id_consumed_at_idx" ON "offer_accept_otp_challenges"("invoice_id", "consumed_at");

-- AddForeignKey
ALTER TABLE "offer_accept_otp_challenges" ADD CONSTRAINT "offer_accept_otp_challenges_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_accept_otp_challenges" ADD CONSTRAINT "offer_accept_otp_challenges_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_accept_otp_challenges" ADD CONSTRAINT "offer_accept_otp_challenges_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
