-- CreateEnum
CREATE TYPE "SigningEnvelopeStatus" AS ENUM ('DRAFT', 'SENT', 'IN_PROGRESS', 'COMPLETED', 'DECLINED', 'VOIDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SigningRoutingMode" AS ENUM ('SEQUENTIAL', 'PARALLEL');

-- CreateEnum
CREATE TYPE "SigningDocumentSource" AS ENUM ('GENERATED_OFFER_LETTER', 'ADMIN_UPLOAD', 'ISSUER_UPLOAD', 'TEMPLATE');

-- CreateEnum
CREATE TYPE "SigningDocumentStatus" AS ENUM ('DRAFT', 'PENDING', 'PARTIALLY_SIGNED', 'COMPLETED', 'VOIDED');

-- CreateEnum
CREATE TYPE "SigningPartyType" AS ENUM ('INTERNAL', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "SigningRecipientStatus" AS ENUM ('PENDING', 'SENT', 'VIEWED', 'SIGNED', 'DECLINED');

-- CreateEnum
CREATE TYPE "SigningKycStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'VERIFIED', 'FAILED');

-- CreateEnum
CREATE TYPE "SigningAction" AS ENUM ('SIGN', 'UPLOAD', 'VIEW');

-- CreateEnum
CREATE TYPE "SigningAssignmentStatus" AS ENUM ('PENDING', 'SENT', 'VIEWED', 'SIGNED', 'DECLINED');

-- CreateTable
CREATE TABLE "signing_envelopes" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "contract_id" TEXT,
    "invoice_id" TEXT,
    "product_version" INTEGER,
    "title" TEXT NOT NULL,
    "status" "SigningEnvelopeStatus" NOT NULL DEFAULT 'DRAFT',
    "routing_mode" "SigningRoutingMode" NOT NULL DEFAULT 'PARALLEL',
    "created_by_user_id" VARCHAR(5),
    "sent_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "voided_at" TIMESTAMP(3),
    "void_reason" TEXT,
    "expires_at" TIMESTAMP(3),
    "provider" TEXT NOT NULL DEFAULT 'signingcloud',
    "provider_ref" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signing_envelopes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signing_documents" (
    "id" TEXT NOT NULL,
    "envelope_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "source" "SigningDocumentSource" NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "unsigned_s3_key" TEXT,
    "signed_s3_key" TEXT,
    "signed_file_sha256" TEXT,
    "provider_contract_ref" TEXT,
    "status" "SigningDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "template_ref" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signing_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signing_recipients" (
    "id" TEXT NOT NULL,
    "envelope_id" TEXT NOT NULL,
    "role_key" TEXT NOT NULL,
    "role_label" TEXT NOT NULL,
    "party_type" "SigningPartyType" NOT NULL,
    "user_id" VARCHAR(5),
    "application_guarantor_id" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ic_number" TEXT,
    "routing_order" INTEGER NOT NULL DEFAULT 0,
    "status" "SigningRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "access_token" TEXT,
    "access_token_expires_at" TIMESTAMP(3),
    "kyc_status" "SigningKycStatus" NOT NULL DEFAULT 'PENDING',
    "kyc_session_token" TEXT,
    "kyc_sdk_endpoint" TEXT,
    "kyc_confirmed_name" TEXT,
    "kyc_confirmed_ic_number" TEXT,
    "kyc_completed_at" TIMESTAMP(3),
    "kyc_last_error" TEXT,
    "sent_at" TIMESTAMP(3),
    "viewed_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "declined_at" TIMESTAMP(3),
    "decline_reason" TEXT,
    "last_reminder_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signing_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signing_assignments" (
    "id" TEXT NOT NULL,
    "envelope_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "action" "SigningAction" NOT NULL DEFAULT 'SIGN',
    "signset" JSONB,
    "status" "SigningAssignmentStatus" NOT NULL DEFAULT 'PENDING',
    "signed_at" TIMESTAMP(3),
    "declined_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signing_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "signing_envelopes_application_id_idx" ON "signing_envelopes"("application_id");

-- CreateIndex
CREATE INDEX "signing_envelopes_contract_id_idx" ON "signing_envelopes"("contract_id");

-- CreateIndex
CREATE INDEX "signing_envelopes_invoice_id_idx" ON "signing_envelopes"("invoice_id");

-- CreateIndex
CREATE INDEX "signing_envelopes_status_idx" ON "signing_envelopes"("status");

-- CreateIndex
CREATE UNIQUE INDEX "signing_documents_provider_contract_ref_key" ON "signing_documents"("provider_contract_ref");

-- CreateIndex
CREATE INDEX "signing_documents_envelope_id_idx" ON "signing_documents"("envelope_id");

-- CreateIndex
CREATE INDEX "signing_documents_provider_contract_ref_idx" ON "signing_documents"("provider_contract_ref");

-- CreateIndex
CREATE UNIQUE INDEX "signing_recipients_access_token_key" ON "signing_recipients"("access_token");

-- CreateIndex
CREATE UNIQUE INDEX "signing_recipients_kyc_session_token_key" ON "signing_recipients"("kyc_session_token");

-- CreateIndex
CREATE INDEX "signing_recipients_envelope_id_idx" ON "signing_recipients"("envelope_id");

-- CreateIndex
CREATE INDEX "signing_recipients_user_id_idx" ON "signing_recipients"("user_id");

-- CreateIndex
CREATE INDEX "signing_recipients_email_idx" ON "signing_recipients"("email");

-- CreateIndex
CREATE INDEX "signing_recipients_status_idx" ON "signing_recipients"("status");

-- CreateIndex
CREATE INDEX "signing_assignments_envelope_id_idx" ON "signing_assignments"("envelope_id");

-- CreateIndex
CREATE INDEX "signing_assignments_document_id_idx" ON "signing_assignments"("document_id");

-- CreateIndex
CREATE INDEX "signing_assignments_recipient_id_idx" ON "signing_assignments"("recipient_id");

-- CreateIndex
CREATE UNIQUE INDEX "signing_assignments_document_id_recipient_id_key" ON "signing_assignments"("document_id", "recipient_id");

-- AddForeignKey
ALTER TABLE "signing_envelopes" ADD CONSTRAINT "signing_envelopes_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signing_envelopes" ADD CONSTRAINT "signing_envelopes_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signing_envelopes" ADD CONSTRAINT "signing_envelopes_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signing_documents" ADD CONSTRAINT "signing_documents_envelope_id_fkey" FOREIGN KEY ("envelope_id") REFERENCES "signing_envelopes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signing_recipients" ADD CONSTRAINT "signing_recipients_envelope_id_fkey" FOREIGN KEY ("envelope_id") REFERENCES "signing_envelopes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signing_assignments" ADD CONSTRAINT "signing_assignments_envelope_id_fkey" FOREIGN KEY ("envelope_id") REFERENCES "signing_envelopes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signing_assignments" ADD CONSTRAINT "signing_assignments_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "signing_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signing_assignments" ADD CONSTRAINT "signing_assignments_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "signing_recipients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
