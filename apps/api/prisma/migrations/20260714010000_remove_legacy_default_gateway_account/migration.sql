-- Remove LEGACY_DEFAULT: historical Curlec rows were created on the merchant
-- now called OPERATING. Rewrite stored LEGACY_DEFAULT → OPERATING, then replace
-- the enum so only OPERATING and INVESTOR_POOL remain.

DO $$
DECLARE
  order_collisions int;
  payment_collisions int;
  event_collisions int;
  recon_collisions int;
  attempt_collisions int;
BEGIN
  SELECT COUNT(*) INTO order_collisions
  FROM (
    SELECT curlec_order_id
    FROM gateway_payments
    WHERE gateway_account::text IN ('LEGACY_DEFAULT', 'OPERATING')
    GROUP BY curlec_order_id
    HAVING COUNT(*) > 1
  ) t;
  IF order_collisions > 0 THEN
    RAISE EXCEPTION
      'Cannot migrate LEGACY_DEFAULT→OPERATING: % colliding gateway_payments.curlec_order_id value(s)',
      order_collisions;
  END IF;

  SELECT COUNT(*) INTO payment_collisions
  FROM (
    SELECT curlec_payment_id
    FROM gateway_payments
    WHERE curlec_payment_id IS NOT NULL
      AND gateway_account::text IN ('LEGACY_DEFAULT', 'OPERATING')
    GROUP BY curlec_payment_id
    HAVING COUNT(*) > 1
  ) t;
  IF payment_collisions > 0 THEN
    RAISE EXCEPTION
      'Cannot migrate LEGACY_DEFAULT→OPERATING: % colliding gateway_payments.curlec_payment_id value(s)',
      payment_collisions;
  END IF;

  SELECT COUNT(*) INTO event_collisions
  FROM (
    SELECT event_id
    FROM gateway_webhook_events
    WHERE gateway_account::text IN ('LEGACY_DEFAULT', 'OPERATING')
    GROUP BY event_id
    HAVING COUNT(*) > 1
  ) t;
  IF event_collisions > 0 THEN
    RAISE EXCEPTION
      'Cannot migrate LEGACY_DEFAULT→OPERATING: % colliding gateway_webhook_events.event_id value(s)',
      event_collisions;
  END IF;

  SELECT COUNT(*) INTO recon_collisions
  FROM (
    SELECT run_date
    FROM gateway_recon_runs
    WHERE gateway_account::text IN ('LEGACY_DEFAULT', 'OPERATING')
    GROUP BY run_date
    HAVING COUNT(*) > 1
  ) t;
  IF recon_collisions > 0 THEN
    RAISE EXCEPTION
      'Cannot migrate LEGACY_DEFAULT→OPERATING: % colliding gateway_recon_runs.run_date value(s)',
      recon_collisions;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'gateway_order_attempts'
  ) THEN
    SELECT COUNT(*) INTO attempt_collisions
    FROM (
      SELECT purpose, scope_key
      FROM gateway_order_attempts
      WHERE gateway_account::text IN ('LEGACY_DEFAULT', 'OPERATING')
      GROUP BY purpose, scope_key
      HAVING COUNT(*) > 1
    ) t;
    IF attempt_collisions > 0 THEN
      RAISE EXCEPTION
        'Cannot migrate LEGACY_DEFAULT→OPERATING: % colliding gateway_order_attempts (purpose, scope_key)',
        attempt_collisions;
    END IF;
  END IF;
END $$;

UPDATE "gateway_payments"
SET "gateway_account" = 'OPERATING'
WHERE "gateway_account" = 'LEGACY_DEFAULT';

UPDATE "gateway_webhook_events"
SET "gateway_account" = 'OPERATING'
WHERE "gateway_account" = 'LEGACY_DEFAULT';

UPDATE "gateway_recon_runs"
SET "gateway_account" = 'OPERATING'
WHERE "gateway_account" = 'LEGACY_DEFAULT';

UPDATE "gateway_order_attempts"
SET "gateway_account" = 'OPERATING'
WHERE "gateway_account" = 'LEGACY_DEFAULT';

CREATE TYPE "CurlecGatewayAccount_new" AS ENUM ('OPERATING', 'INVESTOR_POOL');

ALTER TABLE "gateway_payments"
  ALTER COLUMN "gateway_account" DROP DEFAULT,
  ALTER COLUMN "gateway_account" TYPE "CurlecGatewayAccount_new"
    USING ("gateway_account"::text::"CurlecGatewayAccount_new");

ALTER TABLE "gateway_webhook_events"
  ALTER COLUMN "gateway_account" DROP DEFAULT,
  ALTER COLUMN "gateway_account" TYPE "CurlecGatewayAccount_new"
    USING ("gateway_account"::text::"CurlecGatewayAccount_new");

ALTER TABLE "gateway_recon_runs"
  ALTER COLUMN "gateway_account" DROP DEFAULT,
  ALTER COLUMN "gateway_account" TYPE "CurlecGatewayAccount_new"
    USING ("gateway_account"::text::"CurlecGatewayAccount_new");

ALTER TABLE "gateway_order_attempts"
  ALTER COLUMN "gateway_account" DROP DEFAULT,
  ALTER COLUMN "gateway_account" TYPE "CurlecGatewayAccount_new"
    USING ("gateway_account"::text::"CurlecGatewayAccount_new");

DROP TYPE "CurlecGatewayAccount";
ALTER TYPE "CurlecGatewayAccount_new" RENAME TO "CurlecGatewayAccount";
