DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "notes"
    WHERE "source_invoice_id" IS NOT NULL
    GROUP BY "source_invoice_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add unique notes.source_invoice_id constraint while duplicate invoice notes exist. Resolve duplicate notes before running this migration.';
  END IF;
END $$;

DROP INDEX IF EXISTS "notes_source_invoice_id_idx";

CREATE UNIQUE INDEX "notes_source_invoice_id_key" ON "notes"("source_invoice_id");
