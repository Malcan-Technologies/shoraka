-- CreateTable
CREATE TABLE "issuer_organization_financial_statements" (
    "id" TEXT NOT NULL,
    "issuer_organization_id" TEXT NOT NULL,
    "financial_statements" JSONB NOT NULL,
    "source_application_id" TEXT,
    "source_application_revision_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "issuer_organization_financial_statements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "issuer_organization_financial_statements_issuer_organizatio_key" ON "issuer_organization_financial_statements"("issuer_organization_id");
