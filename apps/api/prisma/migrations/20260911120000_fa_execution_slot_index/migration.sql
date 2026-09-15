-- Two automatic signatories per Facility Agreement Investor and Agent block.
ALTER TABLE "operator_document_execution_bindings"
ADD COLUMN IF NOT EXISTS "slot_index" INTEGER NOT NULL DEFAULT 1;

DROP INDEX IF EXISTS "operator_doc_exec_bindings_profile_role_key";
DROP INDEX IF EXISTS "operator_document_execution_bindings_operator_profile_id_ro_key";

CREATE UNIQUE INDEX "operator_doc_exec_bindings_profile_role_slot_key"
ON "operator_document_execution_bindings"("operator_profile_id", "role_key", "slot_index");
