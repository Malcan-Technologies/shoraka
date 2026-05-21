-- Parse invoice settlement amounts like app toNumber (strip non-numeric) and fix legacy rows.

CREATE OR REPLACE FUNCTION shoraka_parse_invoice_settlement_amount(
  invoice_snapshot JSONB,
  requested_amount NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
  raw TEXT;
  cleaned TEXT;
BEGIN
  raw := COALESCE(
    invoice_snapshot #>> '{details,value}',
    invoice_snapshot #>> '{details,invoice_value}',
    invoice_snapshot #>> '{details,invoiceAmount}',
    invoice_snapshot #>> '{offer_details,invoice_value}'
  );
  IF raw IS NOT NULL AND btrim(raw) <> '' THEN
    cleaned := regexp_replace(raw, '[^0-9.]', '', 'g');
    IF cleaned <> '' THEN
      RETURN NULLIF(cleaned::NUMERIC, 0);
    END IF;
  END IF;
  RETURN NULLIF(requested_amount, 0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

UPDATE note_settlements AS ns
SET
  gross_receipt_amount = capped.settlement_amount,
  issuer_residual_amount = GREATEST(
    0,
    capped.settlement_amount
      - ns.investor_principal
      - ns.investor_profit_gross
      - ns.tawidh_amount
      - ns.gharamah_amount
  ),
  unapplied_amount = 0
FROM notes AS n,
LATERAL (
  SELECT shoraka_parse_invoice_settlement_amount(n.invoice_snapshot::jsonb, n.requested_amount) AS settlement_amount
) AS capped
WHERE ns.note_id = n.id
  AND ns.status IN ('APPROVED', 'PREVIEW')
  AND capped.settlement_amount > 0
  AND ns.gross_receipt_amount > capped.settlement_amount + 0.005
  AND (
    ns.investor_principal
    + ns.investor_profit_gross
    + ns.tawidh_amount
    + ns.gharamah_amount
  ) <= capped.settlement_amount + 0.005;

WITH note_caps AS (
  SELECT
    n.id AS note_id,
    shoraka_parse_invoice_settlement_amount(n.invoice_snapshot::jsonb, n.requested_amount) AS settlement_amount
  FROM notes n
),
open_totals AS (
  SELECT
    np.note_id,
    SUM(np.receipt_amount) AS open_total
  FROM note_payments np
  WHERE np.status IN ('PENDING', 'PARTIAL', 'RECEIVED', 'RECONCILED')
  GROUP BY np.note_id
),
excess_notes AS (
  SELECT nc.note_id, nc.settlement_amount, ot.open_total
  FROM note_caps nc
  INNER JOIN open_totals ot ON ot.note_id = nc.note_id
  WHERE nc.settlement_amount > 0
    AND ot.open_total > nc.settlement_amount + 0.005
)
UPDATE note_payments AS np
SET receipt_amount = ROUND(
  (np.receipt_amount * (en.settlement_amount / en.open_total))::numeric,
  6
)
FROM excess_notes AS en
WHERE np.note_id = en.note_id
  AND np.status IN ('PENDING', 'PARTIAL', 'RECEIVED', 'RECONCILED');

DROP FUNCTION shoraka_parse_invoice_settlement_amount(JSONB, NUMERIC);
