-- Previously this migration added guarantor relationship columns.
-- Per requirement, we store these values only inside `application_guarantors.source_data` JSON.
BEGIN;

COMMIT;

