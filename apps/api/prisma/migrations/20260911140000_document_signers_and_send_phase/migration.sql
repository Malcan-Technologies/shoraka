-- Two CashSouk signers per document (FA/JSG/DoA) plus durable envelope send phases.

CREATE TYPE "OperatorDocumentKind" AS ENUM ('FA', 'JSG', 'DOA');
CREATE TYPE "SigningEnvelopeSendPhase" AS ENUM ('IDLE', 'PREPARING', 'DELIVERING', 'SENT', 'FAILED');

ALTER TABLE "operator_document_execution_bindings"
ADD COLUMN "document_kind" "OperatorDocumentKind",
ADD COLUMN "signer_index" INTEGER;

UPDATE "operator_document_execution_bindings"
SET
  "document_kind" = CASE
    WHEN "role_key"::text IN ('FA_INVESTOR', 'FA_AGENT') THEN 'FA'::"OperatorDocumentKind"
    WHEN "role_key"::text = 'JSG_OPERATOR' THEN 'JSG'::"OperatorDocumentKind"
    ELSE 'DOA'::"OperatorDocumentKind"
  END,
  "signer_index" = "slot_index";

-- Facility Agreement keeps the Investor pair. Matching Agent rows are derived at plan time.
DELETE FROM "operator_document_execution_bindings" AS agent
USING "operator_document_execution_bindings" AS investor
WHERE agent."role_key" = 'FA_AGENT'
  AND investor."role_key" = 'FA_INVESTOR'
  AND agent."operator_profile_id" = investor."operator_profile_id"
  AND agent."signer_index" = investor."signer_index";

DELETE FROM "operator_document_execution_bindings" AS newer
USING "operator_document_execution_bindings" AS older
WHERE newer."operator_profile_id" = older."operator_profile_id"
  AND newer."document_kind" = older."document_kind"
  AND newer."signer_index" = older."signer_index"
  AND newer."id" <> older."id"
  AND newer."created_at" >= older."created_at";

ALTER TABLE "operator_document_execution_bindings"
ALTER COLUMN "document_kind" SET NOT NULL,
ALTER COLUMN "signer_index" SET NOT NULL;

DROP INDEX IF EXISTS "operator_doc_exec_bindings_profile_role_slot_key";
DROP INDEX IF EXISTS "operator_document_execution_bindings_operator_profile_id_ro_key";

ALTER TABLE "operator_document_execution_bindings"
DROP COLUMN "role_key",
DROP COLUMN "slot_index";

CREATE UNIQUE INDEX "operator_doc_exec_bindings_profile_kind_signer_key"
ON "operator_document_execution_bindings"("operator_profile_id", "document_kind", "signer_index");

DROP TYPE "OperatorDocumentExecutionRole";

ALTER TABLE "signing_envelopes"
ADD COLUMN "send_phase" "SigningEnvelopeSendPhase" NOT NULL DEFAULT 'IDLE',
ADD COLUMN "send_error" TEXT,
ADD COLUMN "send_started_at" TIMESTAMP(3),
ADD COLUMN "send_attempt_count" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "signing_envelopes_send_phase_idx" ON "signing_envelopes"("send_phase");

UPDATE "signing_envelopes"
SET
  "send_phase" = 'PREPARING',
  "send_started_at" = COALESCE(
    NULLIF(metadata->'package_send'->>'started_at', '')::timestamp,
    "updated_at"
  )
WHERE "status" = 'DRAFT'
  AND metadata->'package_send'->>'in_progress' = 'true';

UPDATE "signing_envelopes"
SET
  "send_phase" = 'FAILED',
  "send_error" = NULLIF(metadata->'package_send'->>'error', '')
WHERE "status" = 'DRAFT'
  AND metadata->'package_send'->>'error' IS NOT NULL
  AND metadata->'package_send'->>'error' <> ''
  AND "send_phase" = 'IDLE';

UPDATE "signing_envelopes"
SET "send_phase" = 'SENT'
WHERE "status" IN ('SENT', 'IN_PROGRESS', 'COMPLETED')
  AND "send_phase" = 'IDLE';
