-- ComRep master profile: SC enums, issuer/investor org columns, party profiles,
-- and operator (Shoraka) annual RMO models [01000]–[05000], [10000], [11000].

CREATE TYPE "ScCompanyCategory" AS ENUM ('TECHNOLOGY', 'NON_TECHNOLOGY');
CREATE TYPE "ScCompanyType" AS ENUM ('SOLE_PROPRIETORSHIP', 'PARTNERSHIP', 'LLP', 'PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'FOREIGN');
CREATE TYPE "ScShareType" AS ENUM ('ORDINARY', 'PREFERENCE', 'OTHERS');
CREATE TYPE "ScIdentityPrefix" AS ENUM ('NRIC', 'PASSPORT', 'ROC');
CREATE TYPE "ScGender" AS ENUM ('MALE', 'FEMALE', 'NOT_APPLICABLE');
CREATE TYPE "ScPersonKind" AS ENUM ('BOARD', 'MANAGEMENT');
CREATE TYPE "ScDesignation" AS ENUM (
  'CHIEF_EXECUTIVE_OFFICER',
  'CHIEF_COMPLIANCE_OFFICER',
  'CHIEF_FINANCIAL_OFFICER',
  'SECRETARY',
  'CHAIRMAN_EXECUTIVE',
  'CHAIRMAN_NON_EXECUTIVE_NON_INDEPENDENT',
  'CHAIRMAN_NON_EXECUTIVE_INDEPENDENT',
  'DEPUTY_CHAIRMAN_EXECUTIVE',
  'DEPUTY_CHAIRMAN_NON_EXECUTIVE_NON_INDEPENDENT',
  'DEPUTY_CHAIRMAN_NON_EXECUTIVE_INDEPENDENT',
  'DIRECTOR_EXECUTIVE',
  'DIRECTOR_NON_EXECUTIVE_NON_INDEPENDENT',
  'DIRECTOR_NON_EXECUTIVE_INDEPENDENT',
  'ALTERNATE_DIRECTOR',
  'OTHERS'
);
CREATE TYPE "ScInvestorCategory" AS ENUM (
  'ANGEL',
  'RETAIL',
  'SOPHISTICATED_HIGH_NET_WORTH_INDIVIDUAL',
  'SOPHISTICATED_ACCREDITED',
  'SOPHISTICATED_HIGH_NET_WORTH_ENTITY',
  'NON_SOPHISTICATED_ENTITY'
);
CREATE TYPE "ProfileValueSource" AS ENUM ('CTOS', 'REGTANK', 'USER', 'ADMIN', 'SYSTEM');
CREATE TYPE "OrganizationPartyOrigin" AS ENUM ('CTOS_PARTY', 'REGTANK_PARTY', 'USER_MANAGEMENT');
CREATE TYPE "OrganizationPartyEntityType" AS ENUM ('INDIVIDUAL', 'CORPORATE');
CREATE TYPE "OrganizationPartyMembershipStatus" AS ENUM ('MASTER_ACTIVE', 'MASTER_INACTIVE', 'EXTERNAL_OBSERVED');
CREATE TYPE "OperatorAdvisorType" AS ENUM (
  'ACCOUNTING',
  'AUDITOR',
  'BANKER',
  'COMPLIANCE_AND_RISK',
  'CREDIT_RATING',
  'LEGAL',
  'TAXATION',
  'TRUSTEE_ESCROW'
);
CREATE TYPE "OperatorHolderType" AS ENUM ('SHAREHOLDER', 'MEMBER', 'BENEFICIAL_OWNER');

ALTER TABLE "investor_organizations"
  ADD COLUMN "sc_investor_category" "ScInvestorCategory",
  ADD COLUMN "date_of_incorporation" TIMESTAMP(3),
  ADD COLUMN "country_of_incorporation" TEXT,
  ADD COLUMN "residential_address" JSONB,
  ADD COLUMN "profile_field_sources" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "issuer_organizations"
  ADD COLUMN "date_of_incorporation" TIMESTAMP(3),
  ADD COLUMN "date_of_commencement" TIMESTAMP(3),
  ADD COLUMN "country_of_incorporation" TEXT,
  ADD COLUMN "sc_company_type" "ScCompanyType",
  ADD COLUMN "company_category" "ScCompanyCategory",
  ADD COLUMN "company_email" TEXT,
  ADD COLUMN "profile_field_sources" JSONB NOT NULL DEFAULT '{}';

CREATE TABLE "organization_party_profiles" (
  "id" TEXT NOT NULL,
  "issuer_organization_id" TEXT,
  "investor_organization_id" TEXT,
  "party_key" TEXT NOT NULL,
  "origin" "OrganizationPartyOrigin" NOT NULL,
  "membership_status" "OrganizationPartyMembershipStatus" NOT NULL,
  "entity_type" "OrganizationPartyEntityType" NOT NULL,
  "absent_from_latest_external" BOOLEAN NOT NULL DEFAULT false,
  "name" TEXT,
  "salutation" TEXT,
  "identity_prefix" "ScIdentityPrefix",
  "identity_number" TEXT,
  "date_of_birth" TIMESTAMP(3),
  "date_of_incorporation" TIMESTAMP(3),
  "gender" "ScGender",
  "nationality" TEXT,
  "country_of_incorporation" TEXT,
  "address" JSONB,
  "is_director" BOOLEAN NOT NULL DEFAULT false,
  "is_shareholder" BOOLEAN NOT NULL DEFAULT false,
  "is_board" BOOLEAN NOT NULL DEFAULT false,
  "is_management" BOOLEAN NOT NULL DEFAULT false,
  "share_type" "ScShareType",
  "share_type_other" TEXT,
  "shareholding_units" DECIMAL(18,6),
  "shareholding_amount" DECIMAL(18,6),
  "shareholding_percentage" DECIMAL(9,6),
  "designation" "ScDesignation",
  "designation_other" TEXT,
  "appointment_date" TIMESTAMP(3),
  "resignation_date" TIMESTAMP(3),
  "field_sources" JSONB NOT NULL DEFAULT '{}',
  "external_observation" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "organization_party_profiles_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "organization_party_profiles"
  ADD CONSTRAINT "organization_party_profiles_issuer_organization_id_fkey"
  FOREIGN KEY ("issuer_organization_id") REFERENCES "issuer_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_party_profiles"
  ADD CONSTRAINT "organization_party_profiles_investor_organization_id_fkey"
  FOREIGN KEY ("investor_organization_id") REFERENCES "investor_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "organization_party_profiles" ADD CONSTRAINT "organization_party_profiles_org_xor_ck" CHECK (
  (CASE WHEN "issuer_organization_id" IS NOT NULL THEN 1 ELSE 0 END)
  + (CASE WHEN "investor_organization_id" IS NOT NULL THEN 1 ELSE 0 END) = 1
);

CREATE UNIQUE INDEX "organization_party_profiles_issuer_org_party_key_key"
  ON "organization_party_profiles" ("issuer_organization_id", "party_key")
  WHERE "issuer_organization_id" IS NOT NULL;
CREATE UNIQUE INDEX "organization_party_profiles_investor_org_party_key_key"
  ON "organization_party_profiles" ("investor_organization_id", "party_key")
  WHERE "investor_organization_id" IS NOT NULL;

CREATE INDEX "organization_party_profiles_issuer_organization_id_idx" ON "organization_party_profiles"("issuer_organization_id");
CREATE INDEX "organization_party_profiles_investor_organization_id_idx" ON "organization_party_profiles"("investor_organization_id");
CREATE INDEX "organization_party_profiles_issuer_organization_id_membership_status_idx" ON "organization_party_profiles"("issuer_organization_id", "membership_status");
CREATE INDEX "organization_party_profiles_investor_organization_id_membership_status_idx" ON "organization_party_profiles"("investor_organization_id", "membership_status");

CREATE TABLE "operator_profiles" (
  "id" TEXT NOT NULL,
  "singleton_key" TEXT NOT NULL DEFAULT 'cashsouk',
  "name" TEXT,
  "registration_number" TEXT,
  "trustee_registration_number" TEXT,
  "responsible_person_name" TEXT,
  "responsible_person_phone" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "operator_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "operator_profiles_singleton_key_key" ON "operator_profiles"("singleton_key");

CREATE TABLE "operator_share_capital" (
  "id" TEXT NOT NULL,
  "operator_profile_id" TEXT NOT NULL,
  "ordinary_units" DECIMAL(18,0),
  "ordinary_amount" DECIMAL(18,6),
  "preference_units" DECIMAL(18,0),
  "preference_amount" DECIMAL(18,6),
  "others_units" DECIMAL(18,0),
  "others_amount" DECIMAL(18,6),
  "total_paid_up_capital" DECIMAL(18,6),
  "llp_members_capital_units" DECIMAL(18,0),
  "llp_members_capital_amount" DECIMAL(18,6),
  "llp_members_reserves_units" DECIMAL(18,0),
  "llp_members_reserves_amount" DECIMAL(18,6),
  "llp_subordinated_loans_units" DECIMAL(18,0),
  "llp_subordinated_loans_amount" DECIMAL(18,6),
  "total_llp" DECIMAL(18,6),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "operator_share_capital_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "operator_share_capital_operator_profile_id_key" ON "operator_share_capital"("operator_profile_id");
ALTER TABLE "operator_share_capital"
  ADD CONSTRAINT "operator_share_capital_operator_profile_id_fkey"
  FOREIGN KEY ("operator_profile_id") REFERENCES "operator_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "operator_shareholders" (
  "id" TEXT NOT NULL,
  "operator_profile_id" TEXT NOT NULL,
  "holder_type" "OperatorHolderType" NOT NULL,
  "entity_type" "OrganizationPartyEntityType" NOT NULL,
  "name" TEXT,
  "salutation" TEXT,
  "identity_number" TEXT,
  "date_of_birth" TIMESTAMP(3),
  "date_of_incorporation" TIMESTAMP(3),
  "nationality" TEXT,
  "address" TEXT,
  "date_acquired" TIMESTAMP(3),
  "date_disposal" TIMESTAMP(3),
  "share_type" "ScShareType",
  "share_type_other" TEXT,
  "shareholding_units" DECIMAL(18,6),
  "shareholding_amount" DECIMAL(18,6),
  "shareholding_percentage" DECIMAL(9,6),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "operator_shareholders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "operator_shareholders_operator_profile_id_idx" ON "operator_shareholders"("operator_profile_id");
ALTER TABLE "operator_shareholders"
  ADD CONSTRAINT "operator_shareholders_operator_profile_id_fkey"
  FOREIGN KEY ("operator_profile_id") REFERENCES "operator_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "operator_officers" (
  "id" TEXT NOT NULL,
  "operator_profile_id" TEXT NOT NULL,
  "person_kind" "ScPersonKind" NOT NULL,
  "name" TEXT,
  "salutation" TEXT,
  "is_responsible_person" BOOLEAN NOT NULL DEFAULT false,
  "identity_number" TEXT,
  "date_of_birth" TIMESTAMP(3),
  "nationality" TEXT,
  "address" TEXT,
  "designation" "ScDesignation",
  "designation_other" TEXT,
  "appointment_date" TIMESTAMP(3),
  "resignation_date" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "operator_officers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "operator_officers_operator_profile_id_idx" ON "operator_officers"("operator_profile_id");
ALTER TABLE "operator_officers"
  ADD CONSTRAINT "operator_officers_operator_profile_id_fkey"
  FOREIGN KEY ("operator_profile_id") REFERENCES "operator_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "operator_advisors" (
  "id" TEXT NOT NULL,
  "operator_profile_id" TEXT NOT NULL,
  "advisor_type" "OperatorAdvisorType" NOT NULL,
  "name" TEXT,
  "registration_number" TEXT,
  "country" TEXT,
  "address" TEXT,
  "appointment_date" TIMESTAMP(3),
  "cessation_date" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "operator_advisors_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "operator_advisors_operator_profile_id_idx" ON "operator_advisors"("operator_profile_id");
ALTER TABLE "operator_advisors"
  ADD CONSTRAINT "operator_advisors_operator_profile_id_fkey"
  FOREIGN KEY ("operator_profile_id") REFERENCES "operator_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "operator_interests" (
  "id" TEXT NOT NULL,
  "operator_profile_id" TEXT NOT NULL,
  "name" TEXT,
  "registration_number" TEXT,
  "country" TEXT,
  "address" TEXT,
  "acquisition_date" TIMESTAMP(3),
  "disposal_date" TIMESTAMP(3),
  "share_type" "ScShareType",
  "share_type_other" TEXT,
  "shareholding_units" DECIMAL(18,6),
  "shareholding_percentage" DECIMAL(9,6),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "operator_interests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "operator_interests_operator_profile_id_idx" ON "operator_interests"("operator_profile_id");
ALTER TABLE "operator_interests"
  ADD CONSTRAINT "operator_interests_operator_profile_id_fkey"
  FOREIGN KEY ("operator_profile_id") REFERENCES "operator_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "operator_financial_statements" (
  "id" TEXT NOT NULL,
  "operator_profile_id" TEXT NOT NULL,
  "consolidated_accounts" BOOLEAN,
  "auditor_name" TEXT,
  "financial_year_end" TIMESTAMP(3),
  "unmodified_reports" BOOLEAN,
  "date_tabled_to_board" TIMESTAMP(3),
  "currency" TEXT,
  "number_of_shares" DECIMAL(18,0),
  "total_assets" DECIMAL(18,6),
  "non_current_assets" DECIMAL(18,6),
  "current_assets" DECIMAL(18,6),
  "total_equity" DECIMAL(18,6),
  "paid_up_capital" DECIMAL(18,6),
  "share_application_account" DECIMAL(18,6),
  "share_premium_and_reserves" DECIMAL(18,6),
  "accumulated_profit_carried_forward" DECIMAL(18,6),
  "equity_minority_interest" DECIMAL(18,6),
  "total_liabilities" DECIMAL(18,6),
  "non_current_liabilities" DECIMAL(18,6),
  "current_liabilities" DECIMAL(18,6),
  "total_revenue" DECIMAL(18,6),
  "revenue_donation" DECIMAL(18,6),
  "revenue_reward" DECIMAL(18,6),
  "revenue_lending" DECIMAL(18,6),
  "revenue_equity" DECIMAL(18,6),
  "revenue_fees" DECIMAL(18,6),
  "revenue_other" DECIMAL(18,6),
  "income_deposit_interest" DECIMAL(18,6),
  "income_other" DECIMAL(18,6),
  "total_cost" DECIMAL(18,6),
  "cost_staff" DECIMAL(18,6),
  "cost_system" DECIMAL(18,6),
  "cost_promotion" DECIMAL(18,6),
  "cost_other" DECIMAL(18,6),
  "profit_before_tax" DECIMAL(18,6),
  "taxation" DECIMAL(18,6),
  "profit_after_tax" DECIMAL(18,6),
  "pnl_minority_interest" DECIMAL(18,6),
  "net_dividend" DECIMAL(18,6),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "operator_financial_statements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "operator_financial_statements_operator_profile_id_idx" ON "operator_financial_statements"("operator_profile_id");
CREATE INDEX "operator_financial_statements_operator_profile_id_financial_year_end_idx" ON "operator_financial_statements"("operator_profile_id", "financial_year_end");
CREATE UNIQUE INDEX "operator_financial_statements_profile_fye_key"
  ON "operator_financial_statements" ("operator_profile_id", "financial_year_end")
  WHERE "financial_year_end" IS NOT NULL;
ALTER TABLE "operator_financial_statements"
  ADD CONSTRAINT "operator_financial_statements_operator_profile_id_fkey"
  FOREIGN KEY ("operator_profile_id") REFERENCES "operator_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
