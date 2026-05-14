import type { NoteDetail } from "@cashsouk/types";
import { NotePaymentSource, NotePaymentStatus, NoteSettlementStatus } from "@cashsouk/types";

export const REPAYMENT_RECEIPT_SOURCE_ORDER: NotePaymentSource[] = [
  NotePaymentSource.PAYMASTER,
  NotePaymentSource.ISSUER_ON_BEHALF,
  NotePaymentSource.ADMIN_ADJUSTMENT,
];

/** Non-void receipt totals grouped by `NotePaymentSource` (paymaster vs issuer on behalf vs admin). */
export function getRepaymentReceiptsBySource(note: NoteDetail): Record<NotePaymentSource, number> {
  const totals: Record<NotePaymentSource, number> = {
    [NotePaymentSource.PAYMASTER]: 0,
    [NotePaymentSource.ISSUER_ON_BEHALF]: 0,
    [NotePaymentSource.ADMIN_ADJUSTMENT]: 0,
  };
  for (const p of note.payments) {
    if (p.status === NotePaymentStatus.VOID) continue;
    totals[p.source] = totals[p.source] + p.receiptAmount;
  }
  return totals;
}

/** Sum of recorded repayment-pool receipts toward the invoice settlement cap (any source: paymaster, issuer on behalf, admin). Voided rows excluded; includes SETTLED rows after a posted settlement. */
export function getOpenReceiptsTotal(note: NoteDetail): number {
  return note.payments
    .filter((p) => p.status !== NotePaymentStatus.VOID)
    .reduce((sum, p) => sum + p.receiptAmount, 0);
}

export function noteSettlementAmountDue(note: NoteDetail): number {
  const extended = note as NoteDetail & { settlementAmount?: number; invoiceAmount?: number };
  return extended.settlementAmount ?? extended.invoiceAmount ?? note.requestedAmount;
}

export function getActiveSettlementLateFees(note: NoteDetail): number {
  const row = note.settlements.find(
    (s) =>
      s.status === NoteSettlementStatus.PREVIEW ||
      s.status === NoteSettlementStatus.APPROVED ||
      s.status === NoteSettlementStatus.POSTED
  );
  if (!row) return 0;
  return row.tawidhAmount + row.gharamahAmount;
}

export function getIssuerReceiptCap(note: NoteDetail): number {
  return noteSettlementAmountDue(note) + getActiveSettlementLateFees(note);
}

export function getIssuerRemainingReceiptCapacity(note: NoteDetail): number {
  const cap = getIssuerReceiptCap(note);
  const open = getOpenReceiptsTotal(note);
  return Math.max(0, cap - open);
}
