-- Add new enum values for OrganizationMemberRole
-- Note: PostgreSQL requires enum values to be committed before use in UPDATE statements.
-- Data migration will happen in the next migration (20260115200436_migrate_organization_member_data)
ALTER TYPE "OrganizationMemberRole" ADD VALUE IF NOT EXISTS 'ORGANIZATION_ADMIN';
ALTER TYPE "OrganizationMemberRole" ADD VALUE IF NOT EXISTS 'ORGANIZATION_MEMBER';

-- CreateTable: InvestorOrganizationInvitation
CREATE TABLE "investor_organization_invitations" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "OrganizationMemberRole" NOT NULL,
    "investor_organization_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    "accepted_at" TIMESTAMP(3),
    "invited_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investor_organization_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable: IssuerOrganizationInvitation
CREATE TABLE "issuer_organization_invitations" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "OrganizationMemberRole" NOT NULL,
    "issuer_organization_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    "accepted_at" TIMESTAMP(3),
    "invited_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issuer_organization_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "investor_organization_invitations_token_key" ON "investor_organization_invitations"("token");

-- CreateIndex
CREATE INDEX "investor_organization_invitations_email_idx" ON "investor_organization_invitations"("email");

-- CreateIndex
CREATE INDEX "investor_organization_invitations_token_idx" ON "investor_organization_invitations"("token");

-- CreateIndex
CREATE INDEX "investor_organization_invitations_expires_at_idx" ON "investor_organization_invitations"("expires_at");

-- CreateIndex
CREATE INDEX "investor_organization_invitations_investor_organization_id_idx" ON "investor_organization_invitations"("investor_organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "issuer_organization_invitations_token_key" ON "issuer_organization_invitations"("token");

-- CreateIndex
CREATE INDEX "issuer_organization_invitations_email_idx" ON "issuer_organization_invitations"("email");

-- CreateIndex
CREATE INDEX "issuer_organization_invitations_token_idx" ON "issuer_organization_invitations"("token");

-- CreateIndex
CREATE INDEX "issuer_organization_invitations_expires_at_idx" ON "issuer_organization_invitations"("expires_at");

-- CreateIndex
CREATE INDEX "issuer_organization_invitations_issuer_organization_id_idx" ON "issuer_organization_invitations"("issuer_organization_id");

-- AddForeignKey
ALTER TABLE "investor_organization_invitations" ADD CONSTRAINT "investor_organization_invitations_investor_organization_id_fkey" FOREIGN KEY ("investor_organization_id") REFERENCES "investor_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investor_organization_invitations" ADD CONSTRAINT "investor_organization_invitations_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issuer_organization_invitations" ADD CONSTRAINT "issuer_organization_invitations_issuer_organization_id_fkey" FOREIGN KEY ("issuer_organization_id") REFERENCES "issuer_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issuer_organization_invitations" ADD CONSTRAINT "issuer_organization_invitations_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
