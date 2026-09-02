import type { PaymasterFinancingRow, PaymasterLinkedApplicationRow } from "@cashsouk/types";
import { applicationHref } from "@/lib/admin-directory-hrefs";

export type PaymasterLinkedRecordFilter = "issuers" | "applications" | "facilities" | "notes";

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

export function paymasterApplicationReviewHref(
  productId: string | null | undefined,
  applicationId: string | null | undefined
): string | null {
  if (!productId || !applicationId) return null;
  return applicationHref(productId, applicationId);
}

export function uniquePaymasterApplicationCount(
  applications: Array<Pick<PaymasterLinkedApplicationRow, "id">>
): number {
  return new Set(applications.map((row) => row.id)).size;
}
