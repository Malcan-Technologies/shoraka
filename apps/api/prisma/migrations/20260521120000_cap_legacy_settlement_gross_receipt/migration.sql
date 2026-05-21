-- Cap APPROVED/PREVIEW settlements where gross receipt exceeded invoice settlement (pre-v3 receipt model).
-- Invoice amount parsing strips non-numeric characters (matches app toNumber).

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
  SELECT COALESCE(
    CASE
      WHEN regexp_replace(COALESCE(n.invoice_snapshot #>> '{details,value}', ''), '[^0-9.]', '', 'g') <> ''
      THEN NULLIF(
        regexp_replace(COALESCE(n.invoice_snapshot #>> '{details,value}', ''), '[^0-9.]', '', 'g')::numeric,
        0
      )
    END,
    CASE
      WHEN regexp_replace(COALESCE(n.invoice_snapshot #>> '{details,invoice_value}', ''), '[^0-9.]', '', 'g') <> ''
      THEN NULLIF(
        regexp_replace(COALESCE(n.invoice_snapshot #>> '{details,invoice_value}', ''), '[^0-9.]', '', 'g')::numeric,
        0
      )
    END,
    CASE
      WHEN regexp_replace(COALESCE(n.invoice_snapshot #>> '{details,invoiceAmount}', ''), '[^0-9.]', '', 'g') <> ''
      THEN NULLIF(
        regexp_replace(COALESCE(n.invoice_snapshot #>> '{details,invoiceAmount}', ''), '[^0-9.]', '', 'g')::numeric,
        0
      )
    END,
    CASE
      WHEN regexp_replace(COALESCE(n.invoice_snapshot #>> '{offer_details,invoice_value}', ''), '[^0-9.]', '', 'g') <> ''
      THEN NULLIF(
        regexp_replace(COALESCE(n.invoice_snapshot #>> '{offer_details,invoice_value}', ''), '[^0-9.]', '', 'g')::numeric,
        0
      )
    END,
    NULLIF(n.requested_amount, 0)
  ) AS settlement_amount
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
