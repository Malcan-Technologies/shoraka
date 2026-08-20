-- Preserve terminal application status when issuers archive closed files.
ALTER TABLE "applications" ADD COLUMN "archived_at" TIMESTAMP(3);

CREATE INDEX "applications_issuer_organization_id_archived_at_idx"
  ON "applications" ("issuer_organization_id", "archived_at");
