-- Persist trustee instruction email delivery so submit retries skip SES resend.
ALTER TABLE "withdrawal_instructions"
ADD COLUMN "trustee_email_sent_at" TIMESTAMPTZ;

ALTER TABLE "note_settlements"
ADD COLUMN "service_fee_trustee_email_sent_at" TIMESTAMPTZ;
