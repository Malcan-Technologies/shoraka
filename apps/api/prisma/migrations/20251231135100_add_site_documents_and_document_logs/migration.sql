-- CreateEnum
CREATE TYPE "SiteDocumentType" AS ENUM ('TERMS_AND_CONDITIONS', 'PRIVACY_POLICY', 'RISK_DISCLOSURE', 'PLATFORM_AGREEMENT', 'INVESTOR_GUIDE', 'ISSUER_GUIDE', 'OTHER');

-- CreateTable
CREATE TABLE "site_documents" (
    "id" TEXT NOT NULL,
    "type" "SiteDocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "file_name" TEXT NOT NULL,
    "s3_key" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "show_in_account" BOOLEAN NOT NULL DEFAULT false,
    "uploaded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "document_id" TEXT,
    "event_type" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "device_info" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "site_documents_s3_key_key" ON "site_documents"("s3_key");

-- CreateIndex
CREATE INDEX "site_documents_type_is_active_idx" ON "site_documents"("type", "is_active");

-- CreateIndex
CREATE INDEX "site_documents_is_active_show_in_account_idx" ON "site_documents"("is_active", "show_in_account");

-- CreateIndex
CREATE INDEX "site_documents_s3_key_idx" ON "site_documents"("s3_key");

-- CreateIndex
CREATE INDEX "document_logs_user_id_idx" ON "document_logs"("user_id");

-- CreateIndex
CREATE INDEX "document_logs_document_id_idx" ON "document_logs"("document_id");

-- CreateIndex
CREATE INDEX "document_logs_event_type_idx" ON "document_logs"("event_type");

-- CreateIndex
CREATE INDEX "document_logs_created_at_idx" ON "document_logs"("created_at");

-- CreateIndex
CREATE INDEX "document_logs_user_id_created_at_idx" ON "document_logs"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "document_logs" ADD CONSTRAINT "document_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

