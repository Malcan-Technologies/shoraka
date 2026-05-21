-- Align repayment-pool ledger credits with capped note_payments (legacy receipt trim left ledger overstated).

UPDATE note_ledger_entries AS nle
SET amount = np.receipt_amount
FROM note_payments AS np
INNER JOIN note_ledger_accounts AS nla ON nla.code = 'REPAYMENT_POOL'
WHERE nle.payment_id = np.id
  AND nle.account_id = nla.id
  AND nle.direction = 'CREDIT'
  AND nle.idempotency_key = CONCAT('payment:', np.id::text, ':receipt')
  AND ABS(nle.amount - np.receipt_amount) > 0.005;
