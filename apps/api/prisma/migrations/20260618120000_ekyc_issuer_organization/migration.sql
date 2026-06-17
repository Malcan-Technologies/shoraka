-- Bind eKYC sessions to the issuer org validated at session create.
ALTER TABLE "signingcloud_ekyc"
  ADD COLUMN "issuer_organization_id" TEXT;

CREATE INDEX "signingcloud_ekyc_issuer_organization_id_idx"
  ON "signingcloud_ekyc"("issuer_organization_id");

ALTER TABLE "signingcloud_ekyc"
  ADD CONSTRAINT "signingcloud_ekyc_issuer_organization_id_fkey"
  FOREIGN KEY ("issuer_organization_id")
  REFERENCES "issuer_organizations"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
