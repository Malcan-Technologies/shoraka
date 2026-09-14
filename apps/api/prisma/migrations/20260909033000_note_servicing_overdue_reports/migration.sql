-- Servicing ladder: OVERDUE sits between ADVANCE_PAID and LATE.
ALTER TYPE "NoteServicingStatus" ADD VALUE IF NOT EXISTS 'OVERDUE';

CREATE TYPE "DpdBucket" AS ENUM ('CURRENT', 'DPD_1_30', 'DPD_31_60', 'DPD_61_90', 'DPD_90_PLUS');
CREATE TYPE "NoteServicingLetterType" AS ENUM ('ARREARS', 'DEFAULT');
CREATE TYPE "NoteServicingLetterTrigger" AS ENUM ('SYSTEM', 'ADMIN');

ALTER TABLE "notes"
  ADD COLUMN "overdue_started_at" TIMESTAMP(3),
  ADD COLUMN "late_started_at" TIMESTAMP(3),
  ADD COLUMN "days_past_due" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "indicative_tawidh_amount" DECIMAL(18,6) NOT NULL DEFAULT 0,
  ADD COLUMN "indicative_gharamah_amount" DECIMAL(18,6) NOT NULL DEFAULT 0,
  ADD COLUMN "indicative_as_of" TIMESTAMP(3);

ALTER TABLE "note_settlements"
  ADD COLUMN "excess_late_charge_waived_amount" DECIMAL(18,6) NOT NULL DEFAULT 0,
  ADD COLUMN "days_past_due_at_payment" INTEGER,
  ADD COLUMN "dpd_bucket_at_payment" "DpdBucket";

CREATE TABLE "note_late_charge_waivers" (
  "id" TEXT NOT NULL,
  "note_id" TEXT NOT NULL,
  "settlement_id" TEXT,
  "tawidh_waived_amount" DECIMAL(18,6) NOT NULL,
  "gharamah_waived_amount" DECIMAL(18,6) NOT NULL,
  "reason" TEXT NOT NULL,
  "waived_by_admin_user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "note_late_charge_waivers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "note_late_charge_waivers_note_id_idx" ON "note_late_charge_waivers"("note_id");
CREATE INDEX "note_late_charge_waivers_settlement_id_idx" ON "note_late_charge_waivers"("settlement_id");

ALTER TABLE "note_late_charge_waivers"
  ADD CONSTRAINT "note_late_charge_waivers_note_id_fkey"
  FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "note_servicing_letters" (
  "id" TEXT NOT NULL,
  "note_id" TEXT NOT NULL,
  "type" "NoteServicingLetterType" NOT NULL,
  "s3_key" TEXT NOT NULL,
  "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sent_at" TIMESTAMP(3),
  "sent_to" JSONB,
  "triggered_by" "NoteServicingLetterTrigger" NOT NULL,
  CONSTRAINT "note_servicing_letters_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "note_servicing_letters_note_id_idx" ON "note_servicing_letters"("note_id");
CREATE INDEX "note_servicing_letters_type_idx" ON "note_servicing_letters"("type");

ALTER TABLE "note_servicing_letters"
  ADD CONSTRAINT "note_servicing_letters_note_id_fkey"
  FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "note_position_snapshots" (
  "id" TEXT NOT NULL,
  "note_id" TEXT NOT NULL,
  "snapshot_date" DATE NOT NULL,
  "days_past_due" INTEGER NOT NULL DEFAULT 0,
  "dpd_bucket" "DpdBucket" NOT NULL,
  "note_status" "NoteStatus" NOT NULL,
  "servicing_status" "NoteServicingStatus" NOT NULL,
  "outstanding_principal" DECIMAL(18,6) NOT NULL,
  "outstanding_profit" DECIMAL(18,6) NOT NULL,
  "outstanding_total" DECIMAL(18,6) NOT NULL,
  "recovered_principal" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "recovered_profit" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "applied_tawidh" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "applied_gharamah" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "indicative_tawidh" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "indicative_gharamah" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "waived_tawidh" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "waived_gharamah" DECIMAL(18,6) NOT NULL DEFAULT 0,
  "is_sc_default" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "note_position_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "note_position_snapshots_note_id_snapshot_date_key"
  ON "note_position_snapshots"("note_id", "snapshot_date");
CREATE INDEX "note_position_snapshots_snapshot_date_idx"
  ON "note_position_snapshots"("snapshot_date");

ALTER TABLE "note_position_snapshots"
  ADD CONSTRAINT "note_position_snapshots_note_id_fkey"
  FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "notification_types" (
  "id",
  "name",
  "description",
  "category",
  "default_priority",
  "portal_targets",
  "enabled_platform",
  "enabled_email",
  "user_configurable",
  "created_at",
  "updated_at"
)
VALUES
  (
    'note_repayment_due_soon',
    'Repayment due soon',
    'Reminder that a note repayment is due in 7 days or tomorrow.',
    'SYSTEM',
    'INFO',
    ARRAY['ISSUER']::"NotificationPortalTarget"[],
    true,
    true,
    true,
    NOW(),
    NOW()
  ),
  (
    'note_overdue',
    'Note overdue',
    'A note payment is past due and still inside the grace period.',
    'SYSTEM',
    'WARNING',
    ARRAY['ISSUER']::"NotificationPortalTarget"[],
    true,
    true,
    true,
    NOW(),
    NOW()
  ),
  (
    'note_late',
    'Note late',
    'A note payment is past the grace period.',
    'SYSTEM',
    'WARNING',
    ARRAY['ISSUER']::"NotificationPortalTarget"[],
    true,
    true,
    true,
    NOW(),
    NOW()
  ),
  (
    'note_late_investor',
    'Note late',
    'A note you invested in is past the grace period.',
    'SYSTEM',
    'WARNING',
    ARRAY['INVESTOR']::"NotificationPortalTarget"[],
    true,
    true,
    true,
    NOW(),
    NOW()
  )
ON CONFLICT ("id") DO NOTHING;
