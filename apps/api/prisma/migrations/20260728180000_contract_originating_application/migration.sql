-- Link approved contracts to the new_contract application that originated acceptance/signing.
ALTER TABLE "contracts" ADD COLUMN "originating_application_id" TEXT;

CREATE INDEX "contracts_originating_application_id_idx" ON "contracts"("originating_application_id");

ALTER TABLE "contracts" ADD CONSTRAINT "contracts_originating_application_id_fkey"
  FOREIGN KEY ("originating_application_id") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
