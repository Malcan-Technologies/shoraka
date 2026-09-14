-- Independent CashSouk representative pairs plus one reusable witness per section.
CREATE TYPE "OperatorDocumentExecutionRole" AS ENUM (
  'FA_INVESTOR',
  'FA_AGENT',
  'JSG_OPERATOR',
  'DOA_SSP',
  'FA_ISSUER_WITNESS',
  'JSG_GUARANTOR_WITNESS',
  'JSG_OPERATOR_WITNESS',
  'DOA_ASSIGNOR_WITNESS'
);

ALTER TABLE "operator_document_execution_bindings"
ADD COLUMN "role_key" "OperatorDocumentExecutionRole",
ADD COLUMN "slot_index" INTEGER;

-- Agent clones share document_kind=FA and signer_index with Investor until those
-- columns drop. Remove the kind/index unique key first so the copies can land.
DROP INDEX IF EXISTS "operator_doc_exec_bindings_profile_kind_signer_key";
DROP INDEX IF EXISTS "operator_document_execution_bindings_operator_profile_id_do_key";

-- Facility Agreement pair becomes both Investor and Agent. JSG/DoA keep their equivalent roles.
INSERT INTO "operator_document_execution_bindings" (
  "id",
  "operator_profile_id",
  "document_kind",
  "role_key",
  "slot_index",
  "signer_index",
  "signing_person_id",
  "legal_entity_label",
  "created_at",
  "updated_at"
)
SELECT
  concat("id", ':agent'),
  "operator_profile_id",
  "document_kind",
  'FA_AGENT'::"OperatorDocumentExecutionRole",
  "signer_index",
  "signer_index",
  "signing_person_id",
  "legal_entity_label",
  "created_at",
  "updated_at"
FROM "operator_document_execution_bindings"
WHERE "document_kind" = 'FA'
  AND "role_key" IS NULL;

UPDATE "operator_document_execution_bindings"
SET
  "role_key" = CASE
    WHEN "document_kind" = 'FA' THEN 'FA_INVESTOR'::"OperatorDocumentExecutionRole"
    WHEN "document_kind" = 'JSG' THEN 'JSG_OPERATOR'::"OperatorDocumentExecutionRole"
    ELSE 'DOA_SSP'::"OperatorDocumentExecutionRole"
  END,
  "slot_index" = "signer_index"
WHERE "role_key" IS NULL;

ALTER TABLE "operator_document_execution_bindings"
ALTER COLUMN "role_key" SET NOT NULL,
ALTER COLUMN "slot_index" SET NOT NULL;

ALTER TABLE "operator_document_execution_bindings"
DROP COLUMN "document_kind",
DROP COLUMN "signer_index";

CREATE UNIQUE INDEX "operator_doc_exec_bindings_profile_role_slot_key"
ON "operator_document_execution_bindings"("operator_profile_id", "role_key", "slot_index");

DROP TYPE "OperatorDocumentKind";
