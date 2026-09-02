-- PostgreSQL silently truncates identifiers to 63 characters by cutting the
-- suffix. Prisma keeps `_idx` / `_fkey`. Rename after the creating migrations.

-- RenameForeignKey
ALTER TABLE "investment_settlement_confirmations" RENAME CONSTRAINT "investment_settlement_confirmations_investor_organization_id_fk" TO "investment_settlement_confirmations_investor_organization__fkey";

-- RenameIndex
ALTER INDEX "investment_settlement_confirmations_investor_organization_id_id" RENAME TO "investment_settlement_confirmations_investor_organization_i_idx";

-- RenameIndex
ALTER INDEX "investment_settlement_confirmations_scope_current_idx" RENAME TO "investment_settlement_confirmations_settlement_id_investor__idx";

-- RenameIndex
ALTER INDEX "operator_financial_statements_operator_profile_id_financial_yea" RENAME TO "operator_financial_statements_operator_profile_id_financial_idx";

-- RenameIndex
ALTER INDEX "organization_party_profiles_investor_organization_id_membership" RENAME TO "organization_party_profiles_investor_organization_id_member_idx";

-- RenameIndex
ALTER INDEX "organization_party_profiles_issuer_organization_id_membership_s" RENAME TO "organization_party_profiles_issuer_organization_id_membersh_idx";
