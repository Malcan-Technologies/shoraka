import type { LegalAcceptanceStatus } from "@cashsouk/types";
import { formatAuditDateTime } from "@/components/audit/audit-presentation";

export const LEGAL_ACCEPTANCE_STATUS_OPTIONS: { value: LegalAcceptanceStatus; label: string }[] = [
  { value: "NOT_OPENED", label: "Not opened" },
  { value: "OPENED", label: "Opened" },
  { value: "ACCEPTED", label: "Accepted" },
];

export function formatLegalAcceptanceDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return formatAuditDateTime(dateStr) || "—";
}

export function legalAcceptanceStatusLabel(status: LegalAcceptanceStatus): string {
  const match = LEGAL_ACCEPTANCE_STATUS_OPTIONS.find((option) => option.value === status);
  return match?.label ?? status;
}

export function legalAcceptanceEventLabel(status: LegalAcceptanceStatus): string {
  if (status === "ACCEPTED") return "Legal document accepted";
  if (status === "OPENED") return "Legal document opened";
  return "Legal document not opened";
}

export function legalAcceptanceStatusToken(status: LegalAcceptanceStatus) {
  if (status === "ACCEPTED") return "success" as const;
  if (status === "OPENED") return "action" as const;
  return "neutral" as const;
}
