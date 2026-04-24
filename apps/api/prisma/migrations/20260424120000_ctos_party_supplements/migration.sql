CREATE TABLE "ctos_party_supplements" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "party_key" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ctos_party_supplements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ctos_party_supplements_organization_id_party_key_key" ON "ctos_party_supplements"("organization_id", "party_key");

CREATE INDEX "ctos_party_supplements_organization_id_idx" ON "ctos_party_supplements"("organization_id");

ALTER TABLE "ctos_party_supplements" ADD CONSTRAINT "ctos_party_supplements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "issuer_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
