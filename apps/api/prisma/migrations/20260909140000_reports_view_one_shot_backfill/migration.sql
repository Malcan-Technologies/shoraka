UPDATE "admin_roles"
SET "permissions" = array_append("permissions", 'reports.view')
WHERE NOT ('reports.view' = ANY("permissions"))
  AND (
    'notes.view' = ANY("permissions")
    OR 'dashboard.finance.view' = ANY("permissions")
  );
