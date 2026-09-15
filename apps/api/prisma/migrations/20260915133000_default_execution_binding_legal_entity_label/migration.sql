-- Keep legal_entity_label during mixed deploys: old API tasks still write it,
-- and new tasks omit it. Drop the column after that compatible release has drained.
ALTER TABLE "operator_document_execution_bindings"
  ALTER COLUMN "legal_entity_label" SET DEFAULT '';
