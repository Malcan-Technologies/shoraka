-- Normalize item_type and related scope keys: INVOICE -> invoice, DOCUMENT -> document

UPDATE "application_review_items"
SET "item_type" = LOWER("item_type")
WHERE "item_type" IN ('INVOICE', 'DOCUMENT');

UPDATE "application_review_remarks"
SET "scope_key" = LOWER(SPLIT_PART("scope_key", ':', 1)) || ':' || SUBSTRING("scope_key" FROM POSITION(':' IN "scope_key") + 1)
WHERE "scope" = 'item'
  AND ("scope_key" LIKE 'INVOICE:%' OR "scope_key" LIKE 'DOCUMENT:%');

UPDATE "application_review_events"
SET "scope" = LOWER("scope")
WHERE "scope" IN ('INVOICE', 'DOCUMENT');
