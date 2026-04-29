CREATE TYPE "NoteStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'FUNDING', 'ACTIVE', 'REPAID', 'ARREARS', 'DEFAULTED', 'FAILED_FUNDING', 'CANCELLED');
CREATE TYPE "NoteListingStatus" AS ENUM ('NOT_LISTED', 'DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'CLOSED');
CREATE TYPE "NoteFundingStatus" AS ENUM ('NOT_OPEN', 'OPEN', 'FUNDED', 'FAILED', 'CLOSED');
CREATE TYPE "NoteServicingStatus" AS ENUM ('NOT_STARTED', 'CURRENT', 'PARTIAL', 'ADVANCE_PAID', 'LATE', 'ARREARS', 'DEFAULTED', 'SETTLED');
CREATE TYPE "NoteInvestmentStatus" AS ENUM ('COMMITTED', 'CONFIRMED', 'RELEASED', 'CANCELLED', 'SETTLED');
CREATE TYPE "NotePaymentSource" AS ENUM ('PAYMASTER', 'ISSUER_ON_BEHALF', 'ADMIN_ADJUSTMENT');
CREATE TYPE "NotePaymentStatus" AS ENUM ('PENDING', 'PARTIAL', 'RECEIVED', 'RECONCILED', 'SETTLED', 'VOID');
CREATE TYPE "NoteSettlementStatus" AS ENUM ('PREVIEW', 'APPROVED', 'POSTED', 'VOID');
CREATE TYPE "NoteSettlementType" AS ENUM ('STANDARD', 'PARTIAL', 'ADVANCE', 'LATE', 'DEFAULT_RECOVERY');
CREATE TYPE "NoteLedgerAccountType" AS ENUM ('INVESTOR_POOL', 'REPAYMENT_POOL', 'OPERATING_ACCOUNT', 'TAWIDH_ACCOUNT', 'GHARAMAH_ACCOUNT');
CREATE TYPE "NoteLedgerDirection" AS ENUM ('DEBIT', 'CREDIT');
CREATE TYPE "WithdrawalStatus" AS ENUM ('DRAFT', 'LETTER_GENERATED', 'SUBMITTED_TO_TRUSTEE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "WithdrawalType" AS ENUM ('INVESTOR_WITHDRAWAL', 'ISSUER_RESIDUAL_RETURN', 'ADMIN_ADJUSTMENT');

CREATE TABLE "notes" (
  "id" TEXT NOT NULL,
  "source_application_id" TEXT NOT NULL,
  "source_contract_id" TEXT,
  "source_invoice_id" TEXT,
  "issuer_organization_id" TEXT NOT NULL,
  "status" "NoteStatus" NOT NULL DEFAULT 'DRAFT',
  "listing_status" "NoteListingStatus" NOT NULL DEFAULT 'NOT_LISTED',
  "funding_status" "NoteFundingStatus" NOT NULL DEFAULT 'NOT_OPEN',
  "servicing_status" "NoteServicingStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "title" TEXT NOT NULL,
  "note_reference" TEXT NOT NULL,
  "product_snapshot" JSONB,
  "issuer_snapshot" JSONB NOT NULL,
  "paymaster_snapshot" JSONB,
  "contract_snapshot" JSONB,
  "invoice_snapshot" JSONB,
  "requested_amount" NUMERIC(18,6) NOT NULL,
  "target_amount" NUMERIC(18,6) NOT NULL,
  "funded_amount" NUMERIC(18,6) NOT NULL DEFAULT 0,
  "minimum_funding_percent" NUMERIC(5,2) NOT NULL DEFAULT 80,
  "profit_rate_percent" NUMERIC(7,4),
  "platform_fee_rate_percent" NUMERIC(5,2) NOT NULL DEFAULT 0,
  "service_fee_rate_percent" NUMERIC(5,2) NOT NULL DEFAULT 0,
  "service_fee_customer_scope" TEXT,
  "maturity_date" TIMESTAMP(3),
  "grace_period_days" INTEGER NOT NULL DEFAULT 7,
  "arrears_threshold_days" INTEGER NOT NULL DEFAULT 14,
  "tawidh_rate_cap_percent" NUMERIC(5,2) NOT NULL DEFAULT 1,
  "gharamah_rate_cap_percent" NUMERIC(5,2) NOT NULL DEFAULT 9,
  "published_at" TIMESTAMP(3),
  "funding_closed_at" TIMESTAMP(3),
  "activated_at" TIMESTAMP(3),
  "repaid_at" TIMESTAMP(3),
  "arrears_started_at" TIMESTAMP(3),
  "default_marked_at" TIMESTAMP(3),
  "default_marked_by_admin_user_id" TEXT,
  "default_reason" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "note_listings" (
  "id" TEXT NOT NULL,
  "note_id" TEXT NOT NULL,
  "status" "NoteListingStatus" NOT NULL DEFAULT 'DRAFT',
  "opens_at" TIMESTAMP(3),
  "closes_at" TIMESTAMP(3),
  "published_at" TIMESTAMP(3),
  "unpublished_at" TIMESTAMP(3),
  "visibility" TEXT NOT NULL DEFAULT 'INVESTOR_MARKETPLACE',
  "summary" TEXT,
  "risk_disclosure" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "note_listings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "note_investments" (
  "id" TEXT NOT NULL,
  "note_id" TEXT NOT NULL,
  "investor_organization_id" TEXT NOT NULL,
  "investor_user_id" TEXT NOT NULL,
  "status" "NoteInvestmentStatus" NOT NULL DEFAULT 'COMMITTED',
  "amount" NUMERIC(18,6) NOT NULL,
  "allocation_percent" NUMERIC(9,6) NOT NULL DEFAULT 0,
  "committed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmed_at" TIMESTAMP(3),
  "released_at" TIMESTAMP(3),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "note_investments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "note_payment_schedules" (
  "id" TEXT NOT NULL,
  "note_id" TEXT NOT NULL,
  "status" "NotePaymentStatus" NOT NULL DEFAULT 'PENDING',
  "sequence" INTEGER NOT NULL,
  "due_date" TIMESTAMP(3) NOT NULL,
  "expected_principal" NUMERIC(18,6) NOT NULL DEFAULT 0,
  "expected_profit" NUMERIC(18,6) NOT NULL DEFAULT 0,
  "expected_total" NUMERIC(18,6) NOT NULL DEFAULT 0,
  "paid_principal" NUMERIC(18,6) NOT NULL DEFAULT 0,
  "paid_profit" NUMERIC(18,6) NOT NULL DEFAULT 0,
  "paid_total" NUMERIC(18,6) NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "note_payment_schedules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "note_payments" (
  "id" TEXT NOT NULL,
  "note_id" TEXT NOT NULL,
  "schedule_id" TEXT,
  "source" "NotePaymentSource" NOT NULL,
  "status" "NotePaymentStatus" NOT NULL DEFAULT 'PENDING',
  "receipt_amount" NUMERIC(18,6) NOT NULL,
  "receipt_date" TIMESTAMP(3) NOT NULL,
  "received_into_account_code" TEXT NOT NULL DEFAULT 'REPAYMENT_POOL',
  "evidence_s3_key" TEXT,
  "reference" TEXT,
  "recorded_by_user_id" TEXT,
  "reconciled_by_user_id" TEXT,
  "reconciled_at" TIMESTAMP(3),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "note_payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "note_settlements" (
  "id" TEXT NOT NULL,
  "note_id" TEXT NOT NULL,
  "payment_id" TEXT,
  "status" "NoteSettlementStatus" NOT NULL DEFAULT 'PREVIEW',
  "settlement_type" "NoteSettlementType" NOT NULL DEFAULT 'STANDARD',
  "gross_receipt_amount" NUMERIC(18,6) NOT NULL DEFAULT 0,
  "investor_principal" NUMERIC(18,6) NOT NULL DEFAULT 0,
  "investor_profit_gross" NUMERIC(18,6) NOT NULL DEFAULT 0,
  "service_fee_amount" NUMERIC(18,6) NOT NULL DEFAULT 0,
  "investor_profit_net" NUMERIC(18,6) NOT NULL DEFAULT 0,
  "tawidh_amount" NUMERIC(18,6) NOT NULL DEFAULT 0,
  "gharamah_amount" NUMERIC(18,6) NOT NULL DEFAULT 0,
  "issuer_residual_amount" NUMERIC(18,6) NOT NULL DEFAULT 0,
  "unapplied_amount" NUMERIC(18,6) NOT NULL DEFAULT 0,
  "preview_snapshot" JSONB NOT NULL,
  "approved_by_user_id" TEXT,
  "approved_at" TIMESTAMP(3),
  "posted_at" TIMESTAMP(3),
  "idempotency_key" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "note_settlements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "note_ledger_accounts" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "NoteLedgerAccountType" NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'MYR',
  "is_system" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "note_ledger_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "note_ledger_entries" (
  "id" TEXT NOT NULL,
  "note_id" TEXT,
  "account_id" TEXT NOT NULL,
  "settlement_id" TEXT,
  "payment_id" TEXT,
  "withdrawal_id" TEXT,
  "direction" "NoteLedgerDirection" NOT NULL,
  "amount" NUMERIC(18,6) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'MYR',
  "description" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "metadata" JSONB,
  "posted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "note_ledger_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "note_events" (
  "id" TEXT NOT NULL,
  "note_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "actor_user_id" TEXT,
  "actor_role" TEXT,
  "portal" TEXT,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "correlation_id" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "note_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "note_admin_actions" (
  "id" TEXT NOT NULL,
  "note_id" TEXT NOT NULL,
  "action_type" TEXT NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "reason" TEXT,
  "before_state" JSONB,
  "after_state" JSONB,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "correlation_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "note_admin_actions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platform_finance_settings" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "grace_period_days" INTEGER NOT NULL DEFAULT 7,
  "arrears_threshold_days" INTEGER NOT NULL DEFAULT 14,
  "tawidh_rate_cap_percent" NUMERIC(5,2) NOT NULL DEFAULT 1,
  "gharamah_rate_cap_percent" NUMERIC(5,2) NOT NULL DEFAULT 9,
  "default_tawidh_rate_percent" NUMERIC(5,2) NOT NULL DEFAULT 0,
  "default_gharamah_rate_percent" NUMERIC(5,2) NOT NULL DEFAULT 0,
  "withdrawal_letter_template" TEXT NOT NULL DEFAULT 'DEFAULT_WITHDRAWAL_LETTER',
  "arrears_letter_template" TEXT NOT NULL DEFAULT 'DEFAULT_ARREARS_LETTER',
  "default_letter_template" TEXT NOT NULL DEFAULT 'DEFAULT_DEFAULT_LETTER',
  "updated_by_user_id" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "platform_finance_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "withdrawal_instructions" (
  "id" TEXT NOT NULL,
  "note_id" TEXT,
  "investor_organization_id" TEXT,
  "issuer_organization_id" TEXT,
  "requested_by_user_id" TEXT NOT NULL,
  "submitted_by_user_id" TEXT,
  "status" "WithdrawalStatus" NOT NULL DEFAULT 'DRAFT',
  "withdrawal_type" "WithdrawalType" NOT NULL,
  "amount" NUMERIC(18,6) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'MYR',
  "beneficiary_snapshot" JSONB NOT NULL,
  "letter_s3_key" TEXT,
  "generated_at" TIMESTAMP(3),
  "submitted_to_trustee_at" TIMESTAMP(3),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "withdrawal_instructions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notes_note_reference_key" ON "notes"("note_reference");
CREATE INDEX "notes_source_application_id_idx" ON "notes"("source_application_id");
CREATE INDEX "notes_source_contract_id_idx" ON "notes"("source_contract_id");
CREATE INDEX "notes_source_invoice_id_idx" ON "notes"("source_invoice_id");
CREATE INDEX "notes_issuer_organization_id_idx" ON "notes"("issuer_organization_id");
CREATE INDEX "notes_status_idx" ON "notes"("status");
CREATE INDEX "notes_listing_status_idx" ON "notes"("listing_status");
CREATE INDEX "notes_funding_status_idx" ON "notes"("funding_status");
CREATE INDEX "notes_servicing_status_idx" ON "notes"("servicing_status");
CREATE INDEX "notes_maturity_date_idx" ON "notes"("maturity_date");
CREATE UNIQUE INDEX "note_listings_note_id_key" ON "note_listings"("note_id");
CREATE INDEX "note_listings_status_idx" ON "note_listings"("status");
CREATE INDEX "note_listings_opens_at_idx" ON "note_listings"("opens_at");
CREATE INDEX "note_listings_closes_at_idx" ON "note_listings"("closes_at");
CREATE INDEX "note_investments_note_id_idx" ON "note_investments"("note_id");
CREATE INDEX "note_investments_investor_organization_id_idx" ON "note_investments"("investor_organization_id");
CREATE INDEX "note_investments_investor_user_id_idx" ON "note_investments"("investor_user_id");
CREATE INDEX "note_investments_status_idx" ON "note_investments"("status");
CREATE UNIQUE INDEX "note_payment_schedules_note_id_sequence_key" ON "note_payment_schedules"("note_id", "sequence");
CREATE INDEX "note_payment_schedules_note_id_idx" ON "note_payment_schedules"("note_id");
CREATE INDEX "note_payment_schedules_status_idx" ON "note_payment_schedules"("status");
CREATE INDEX "note_payment_schedules_due_date_idx" ON "note_payment_schedules"("due_date");
CREATE INDEX "note_payments_note_id_idx" ON "note_payments"("note_id");
CREATE INDEX "note_payments_schedule_id_idx" ON "note_payments"("schedule_id");
CREATE INDEX "note_payments_source_idx" ON "note_payments"("source");
CREATE INDEX "note_payments_status_idx" ON "note_payments"("status");
CREATE INDEX "note_payments_receipt_date_idx" ON "note_payments"("receipt_date");
CREATE UNIQUE INDEX "note_settlements_idempotency_key_key" ON "note_settlements"("idempotency_key");
CREATE INDEX "note_settlements_note_id_idx" ON "note_settlements"("note_id");
CREATE INDEX "note_settlements_payment_id_idx" ON "note_settlements"("payment_id");
CREATE INDEX "note_settlements_status_idx" ON "note_settlements"("status");
CREATE INDEX "note_settlements_posted_at_idx" ON "note_settlements"("posted_at");
CREATE UNIQUE INDEX "note_ledger_accounts_code_key" ON "note_ledger_accounts"("code");
CREATE INDEX "note_ledger_accounts_type_idx" ON "note_ledger_accounts"("type");
CREATE UNIQUE INDEX "note_ledger_entries_idempotency_key_key" ON "note_ledger_entries"("idempotency_key");
CREATE INDEX "note_ledger_entries_note_id_idx" ON "note_ledger_entries"("note_id");
CREATE INDEX "note_ledger_entries_account_id_idx" ON "note_ledger_entries"("account_id");
CREATE INDEX "note_ledger_entries_settlement_id_idx" ON "note_ledger_entries"("settlement_id");
CREATE INDEX "note_ledger_entries_payment_id_idx" ON "note_ledger_entries"("payment_id");
CREATE INDEX "note_ledger_entries_withdrawal_id_idx" ON "note_ledger_entries"("withdrawal_id");
CREATE INDEX "note_ledger_entries_posted_at_idx" ON "note_ledger_entries"("posted_at");
CREATE INDEX "note_events_note_id_idx" ON "note_events"("note_id");
CREATE INDEX "note_events_event_type_idx" ON "note_events"("event_type");
CREATE INDEX "note_events_actor_user_id_idx" ON "note_events"("actor_user_id");
CREATE INDEX "note_events_created_at_idx" ON "note_events"("created_at");
CREATE INDEX "note_admin_actions_note_id_idx" ON "note_admin_actions"("note_id");
CREATE INDEX "note_admin_actions_action_type_idx" ON "note_admin_actions"("action_type");
CREATE INDEX "note_admin_actions_actor_user_id_idx" ON "note_admin_actions"("actor_user_id");
CREATE INDEX "note_admin_actions_created_at_idx" ON "note_admin_actions"("created_at");
CREATE UNIQUE INDEX "platform_finance_settings_key_key" ON "platform_finance_settings"("key");
CREATE INDEX "withdrawal_instructions_note_id_idx" ON "withdrawal_instructions"("note_id");
CREATE INDEX "withdrawal_instructions_investor_organization_id_idx" ON "withdrawal_instructions"("investor_organization_id");
CREATE INDEX "withdrawal_instructions_issuer_organization_id_idx" ON "withdrawal_instructions"("issuer_organization_id");
CREATE INDEX "withdrawal_instructions_requested_by_user_id_idx" ON "withdrawal_instructions"("requested_by_user_id");
CREATE INDEX "withdrawal_instructions_status_idx" ON "withdrawal_instructions"("status");
CREATE INDEX "withdrawal_instructions_created_at_idx" ON "withdrawal_instructions"("created_at");

ALTER TABLE "note_listings" ADD CONSTRAINT "note_listings_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "note_investments" ADD CONSTRAINT "note_investments_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "note_payment_schedules" ADD CONSTRAINT "note_payment_schedules_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "note_payments" ADD CONSTRAINT "note_payments_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "note_settlements" ADD CONSTRAINT "note_settlements_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "note_ledger_entries" ADD CONSTRAINT "note_ledger_entries_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "note_ledger_entries" ADD CONSTRAINT "note_ledger_entries_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "note_ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "note_events" ADD CONSTRAINT "note_events_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "note_admin_actions" ADD CONSTRAINT "note_admin_actions_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "note_ledger_accounts" ("id", "code", "name", "type", "updated_at") VALUES
  ('note_account_investor_pool', 'INVESTOR_POOL', 'Investor Pool', 'INVESTOR_POOL', CURRENT_TIMESTAMP),
  ('note_account_repayment_pool', 'REPAYMENT_POOL', 'Repayment Pool', 'REPAYMENT_POOL', CURRENT_TIMESTAMP),
  ('note_account_operating', 'OPERATING_ACCOUNT', 'Operating Account', 'OPERATING_ACCOUNT', CURRENT_TIMESTAMP),
  ('note_account_tawidh', 'TAWIDH_ACCOUNT', 'Ta''widh Account', 'TAWIDH_ACCOUNT', CURRENT_TIMESTAMP),
  ('note_account_gharamah', 'GHARAMAH_ACCOUNT', 'Gharamah Account', 'GHARAMAH_ACCOUNT', CURRENT_TIMESTAMP);

INSERT INTO "platform_finance_settings" ("id", "key", "updated_at") VALUES
  ('platform_finance_default', 'DEFAULT', CURRENT_TIMESTAMP);
