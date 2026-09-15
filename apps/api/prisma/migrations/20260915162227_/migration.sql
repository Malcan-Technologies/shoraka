-- Duplicate of 20260915141453_a (same DROP generated on a parallel branch).
-- IF EXISTS so this is a no-op when that earlier migration already ran.
ALTER TABLE "operator_document_execution_bindings" DROP COLUMN IF EXISTS "legal_entity_label";
