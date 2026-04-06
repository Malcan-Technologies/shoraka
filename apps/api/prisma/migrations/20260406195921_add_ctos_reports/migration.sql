-- CreateTable
CREATE TABLE "ctos_reports" (
    "id" TEXT NOT NULL,
    "issuer_organization_id" TEXT NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "raw_xml" TEXT NOT NULL,
    "report_html" TEXT,
    "summary_json" JSONB NOT NULL,
    "company_json" JSONB NOT NULL,
    "legal_json" JSONB NOT NULL,
    "ccris_json" JSONB NOT NULL,
    "financials_json" JSONB NOT NULL,

    CONSTRAINT "ctos_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ctos_reports_issuer_organization_id_idx" ON "ctos_reports"("issuer_organization_id");

-- CreateIndex
CREATE INDEX "ctos_reports_issuer_organization_id_fetched_at_idx" ON "ctos_reports"("issuer_organization_id", "fetched_at" DESC);

-- AddForeignKey
ALTER TABLE "ctos_reports" ADD CONSTRAINT "ctos_reports_issuer_organization_id_fkey" FOREIGN KEY ("issuer_organization_id") REFERENCES "issuer_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
