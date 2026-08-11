-- Phase 1 canonical display-reference foundation (additive only)

-- Product family code foundation (nullable; backfill later)
ALTER TABLE "products"
ADD COLUMN "product_code" TEXT;

CREATE INDEX "products_product_code_idx" ON "products"("product_code");

-- Future canonical display reference columns (nullable in Phase 1)
ALTER TABLE "applications"
ADD COLUMN "display_reference" TEXT;

CREATE UNIQUE INDEX "applications_display_reference_key" ON "applications"("display_reference");
CREATE INDEX "applications_display_reference_idx" ON "applications"("display_reference");

ALTER TABLE "contracts"
ADD COLUMN "display_reference" TEXT;

CREATE UNIQUE INDEX "contracts_display_reference_key" ON "contracts"("display_reference");
CREATE INDEX "contracts_display_reference_idx" ON "contracts"("display_reference");

ALTER TABLE "invoices"
ADD COLUMN "display_reference" TEXT;

CREATE UNIQUE INDEX "invoices_display_reference_key" ON "invoices"("display_reference");
CREATE INDEX "invoices_display_reference_idx" ON "invoices"("display_reference");

ALTER TABLE "note_settlements"
ADD COLUMN "display_reference" TEXT;

CREATE UNIQUE INDEX "note_settlements_display_reference_key" ON "note_settlements"("display_reference");
CREATE INDEX "note_settlements_display_reference_idx" ON "note_settlements"("display_reference");

ALTER TABLE "withdrawal_instructions"
ADD COLUMN "display_reference" TEXT;

CREATE UNIQUE INDEX "withdrawal_instructions_display_reference_key" ON "withdrawal_instructions"("display_reference");
CREATE INDEX "withdrawal_instructions_display_reference_idx" ON "withdrawal_instructions"("display_reference");

ALTER TABLE "issuer_organizations"
ADD COLUMN "display_reference" TEXT;

CREATE UNIQUE INDEX "issuer_organizations_display_reference_key" ON "issuer_organizations"("display_reference");
CREATE INDEX "issuer_organizations_display_reference_idx" ON "issuer_organizations"("display_reference");

ALTER TABLE "investor_organizations"
ADD COLUMN "display_reference" TEXT;

CREATE UNIQUE INDEX "investor_organizations_display_reference_key" ON "investor_organizations"("display_reference");
CREATE INDEX "investor_organizations_display_reference_idx" ON "investor_organizations"("display_reference");

-- Global allocation registry for canonical references (module/product/entity audit)
CREATE TABLE "display_reference_allocations" (
  "id" TEXT NOT NULL,
  "display_reference" TEXT NOT NULL,
  "module_code" TEXT NOT NULL,
  "product_code" TEXT,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "allocated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "display_reference_allocations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "display_reference_allocations_display_reference_key"
  ON "display_reference_allocations"("display_reference");
CREATE UNIQUE INDEX "display_reference_allocations_entity_type_entity_id_key"
  ON "display_reference_allocations"("entity_type", "entity_id");
CREATE INDEX "display_reference_allocations_product_code_idx"
  ON "display_reference_allocations"("product_code");
