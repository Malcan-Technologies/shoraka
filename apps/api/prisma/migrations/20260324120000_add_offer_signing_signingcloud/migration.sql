-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "offer_signing" JSONB,
ADD COLUMN     "signing_sc_contractnum" TEXT;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "offer_signing" JSONB,
ADD COLUMN     "signing_sc_contractnum" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "contracts_signing_sc_contractnum_key" ON "contracts"("signing_sc_contractnum");

-- CreateIndex
CREATE INDEX "contracts_signing_sc_contractnum_idx" ON "contracts"("signing_sc_contractnum");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_signing_sc_contractnum_key" ON "invoices"("signing_sc_contractnum");

-- CreateIndex
CREATE INDEX "invoices_signing_sc_contractnum_idx" ON "invoices"("signing_sc_contractnum");
