-- CreateEnum
CREATE TYPE "GuarantorType" AS ENUM ('individual', 'company');

-- CreateEnum
CREATE TYPE "GuarantorAmlStatus" AS ENUM ('Unresolved', 'Approved', 'Rejected', 'Pending');

-- CreateEnum
CREATE TYPE "GuarantorAmlMessage" AS ENUM ('DONE', 'PENDING', 'ERROR');

-- CreateTable
CREATE TABLE "guarantors" (
    "id" TEXT NOT NULL,
    "canonical_key" TEXT NOT NULL,
    "guarantor_type" "GuarantorType" NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "company_name" TEXT,
    "ic_number" TEXT,
    "ssm_number" TEXT,
    "onboarding_request_id" TEXT,
    "onboarding_verify_link" TEXT,
    "kyc_id" TEXT,
    "kyb_id" TEXT,
    "regtank_portal_url" TEXT,
    "onboarding_status" TEXT,
    "onboarding_substatus" TEXT,
    "aml_status" "GuarantorAmlStatus" NOT NULL DEFAULT 'Pending',
    "aml_message_status" "GuarantorAmlMessage" NOT NULL DEFAULT 'PENDING',
    "aml_risk_score" DOUBLE PRECISION,
    "aml_risk_level" TEXT,
    "last_triggered_at" TIMESTAMP(3),
    "last_synced_at" TIMESTAMP(3),
    "triggered_by_admin_user_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guarantors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_guarantors" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "guarantor_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "relationship" TEXT,
    "source_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "application_guarantors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guarantors_canonical_key_key" ON "guarantors"("canonical_key");
CREATE UNIQUE INDEX "guarantors_onboarding_request_id_key" ON "guarantors"("onboarding_request_id");
CREATE UNIQUE INDEX "guarantors_kyc_id_key" ON "guarantors"("kyc_id");
CREATE UNIQUE INDEX "guarantors_kyb_id_key" ON "guarantors"("kyb_id");
CREATE INDEX "guarantors_email_idx" ON "guarantors"("email");
CREATE INDEX "guarantors_ic_number_idx" ON "guarantors"("ic_number");
CREATE INDEX "guarantors_ssm_number_idx" ON "guarantors"("ssm_number");
CREATE INDEX "guarantors_onboarding_request_id_idx" ON "guarantors"("onboarding_request_id");
CREATE INDEX "guarantors_canonical_key_idx" ON "guarantors"("canonical_key");

-- CreateIndex
CREATE UNIQUE INDEX "application_guarantors_application_id_guarantor_id_key" ON "application_guarantors"("application_id", "guarantor_id");
CREATE INDEX "application_guarantors_application_id_idx" ON "application_guarantors"("application_id");
CREATE INDEX "application_guarantors_guarantor_id_idx" ON "application_guarantors"("guarantor_id");
CREATE INDEX "application_guarantors_application_id_position_idx" ON "application_guarantors"("application_id", "position");

-- AddForeignKey
ALTER TABLE "guarantors" ADD CONSTRAINT "guarantors_triggered_by_admin_user_id_fkey"
FOREIGN KEY ("triggered_by_admin_user_id") REFERENCES "users"("user_id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_guarantors" ADD CONSTRAINT "application_guarantors_application_id_fkey"
FOREIGN KEY ("application_id") REFERENCES "applications"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_guarantors" ADD CONSTRAINT "application_guarantors_guarantor_id_fkey"
FOREIGN KEY ("guarantor_id") REFERENCES "guarantors"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
