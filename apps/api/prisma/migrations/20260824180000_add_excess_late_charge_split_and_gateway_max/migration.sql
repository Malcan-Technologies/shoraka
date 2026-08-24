-- Frozen unpaid Ta'widh / Gharamah split for separately collected late charges.
-- Destinations differ, so the split cannot be inferred later from mutable note settings.

ALTER TABLE "note_settlements"
ADD COLUMN "excess_tawidh_amount" DECIMAL(18,6) NOT NULL DEFAULT 0,
ADD COLUMN "excess_gharamah_amount" DECIMAL(18,6) NOT NULL DEFAULT 0;

UPDATE "note_settlements"
SET
  "excess_tawidh_amount" = COALESCE(("preview_snapshot"->>'unpaidTawidhAmount')::numeric, 0),
  "excess_gharamah_amount" = COALESCE(("preview_snapshot"->>'unpaidGharamahAmount')::numeric, 0)
WHERE "excess_late_charge_amount" > 0;

ALTER TABLE "platform_finance_settings"
ADD COLUMN "excess_late_charge_gateway_txn_max_amount" DECIMAL(18,6) NOT NULL DEFAULT 30000;
