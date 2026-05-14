DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'i'
      AND c.relname = 'investor_balance_transactions_investor_organization_id_posted_a'
  ) THEN
    EXECUTE format(
      'ALTER INDEX %I RENAME TO %I',
      'investor_balance_transactions_investor_organization_id_posted_a',
      'investor_balance_transactions_investor_organization_id_post_idx'
    );
  END IF;
END $$;