import type { PaymasterFinancingRow } from "@cashsouk/types";

export type PaymasterLinkedRecordFilter = "issuers" | "facilities" | "notes";

export function isPaymasterFacilityRow(row: PaymasterFinancingRow): boolean {
  return Boolean(row.contractId || row.contractDisplayReference);
}

export function isPaymasterNoteRow(row: PaymasterFinancingRow): boolean {
  return Boolean(row.noteId || row.noteReference);
}

export function paymasterFinancingKind(row: PaymasterFinancingRow): "Note" | "Facility" | "Application" {
  if (isPaymasterNoteRow(row)) return "Note";
  if (isPaymasterFacilityRow(row)) return "Facility";
  return "Application";
}

export function paymasterFinancingTitle(row: PaymasterFinancingRow): string {
  return (
    row.noteReference ||
    row.contractDisplayReference ||
    row.applicationDisplayReference ||
    "—"
  );
}

export function paymasterFinancingHref(row: PaymasterFinancingRow): string | null {
  if (row.noteId) return `/notes/${encodeURIComponent(row.noteId)}`;
  if (row.contractId) return `/contracts/${encodeURIComponent(row.contractId)}`;
  return null;
}
