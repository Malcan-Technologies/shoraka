-- Legal documents: at most one active Published version per definition.
-- ARCHIVED MEANS INACTIVE. No automatic fallback to an older Published row.

-- Repair any existing duplicate Published versions: keep highest version number,
-- archive the rest. Preserve rows, acceptances, and audit history.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "legal_document_id"
      ORDER BY "version" DESC
    ) AS rn
  FROM "legal_document_versions"
  WHERE "status" = 'PUBLISHED'
)
UPDATE "legal_document_versions" AS v
SET
  "status" = 'ARCHIVED',
  "archived_at" = COALESCE(v."archived_at", NOW()),
  "archived_by" = COALESCE(v."archived_by", 'system-repair-one-published'),
  "updated_at" = NOW()
FROM ranked AS r
WHERE v.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "legal_document_versions_one_published_per_document"
ON "legal_document_versions" ("legal_document_id")
WHERE "status" = 'PUBLISHED';
