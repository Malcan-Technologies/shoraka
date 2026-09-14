-- RenameIndex
ALTER INDEX "issuer_org_seals_org_superseded_idx" RENAME TO "issuer_organization_company_seals_issuer_organization_id_su_idx";

-- RenameIndex
ALTER INDEX "operator_doc_exec_bindings_person_idx" RENAME TO "operator_document_execution_bindings_signing_person_id_idx";

-- RenameIndex
ALTER INDEX "operator_doc_exec_bindings_profile_role_key" RENAME TO "operator_document_execution_bindings_operator_profile_id_ro_key";
