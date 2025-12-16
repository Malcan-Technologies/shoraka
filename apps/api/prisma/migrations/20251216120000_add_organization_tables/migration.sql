-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('PERSONAL', 'COMPANY');

-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('PENDING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "OrganizationMemberRole" AS ENUM ('OWNER', 'DIRECTOR', 'MEMBER');

-- CreateTable
CREATE TABLE "investor_organizations" (
    "id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "type" "OrganizationType" NOT NULL,
    "name" TEXT,
    "registration_number" TEXT,
    "onboarding_status" "OnboardingStatus" NOT NULL DEFAULT 'PENDING',
    "onboarded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investor_organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issuer_organizations" (
    "id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "type" "OrganizationType" NOT NULL,
    "name" TEXT,
    "registration_number" TEXT,
    "onboarding_status" "OnboardingStatus" NOT NULL DEFAULT 'PENDING',
    "onboarded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "issuer_organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "investor_organization_id" TEXT,
    "issuer_organization_id" TEXT,
    "role" "OrganizationMemberRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "investor_organizations_owner_user_id_idx" ON "investor_organizations"("owner_user_id");

-- CreateIndex
CREATE INDEX "investor_organizations_owner_user_id_type_idx" ON "investor_organizations"("owner_user_id", "type");

-- CreateIndex
CREATE INDEX "investor_organizations_onboarding_status_idx" ON "investor_organizations"("onboarding_status");

-- CreateIndex
CREATE INDEX "issuer_organizations_owner_user_id_idx" ON "issuer_organizations"("owner_user_id");

-- CreateIndex
CREATE INDEX "issuer_organizations_owner_user_id_type_idx" ON "issuer_organizations"("owner_user_id", "type");

-- CreateIndex
CREATE INDEX "issuer_organizations_onboarding_status_idx" ON "issuer_organizations"("onboarding_status");

-- CreateIndex
CREATE INDEX "organization_members_user_id_idx" ON "organization_members"("user_id");

-- CreateIndex
CREATE INDEX "organization_members_investor_organization_id_idx" ON "organization_members"("investor_organization_id");

-- CreateIndex
CREATE INDEX "organization_members_issuer_organization_id_idx" ON "organization_members"("issuer_organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_user_id_investor_organization_id_key" ON "organization_members"("user_id", "investor_organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_user_id_issuer_organization_id_key" ON "organization_members"("user_id", "issuer_organization_id");

-- AddForeignKey
ALTER TABLE "investor_organizations" ADD CONSTRAINT "investor_organizations_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issuer_organizations" ADD CONSTRAINT "issuer_organizations_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_investor_organization_id_fkey" FOREIGN KEY ("investor_organization_id") REFERENCES "investor_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_issuer_organization_id_fkey" FOREIGN KEY ("issuer_organization_id") REFERENCES "issuer_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

