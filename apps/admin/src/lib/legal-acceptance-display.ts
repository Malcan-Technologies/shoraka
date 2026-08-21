import type { LegalAcceptanceStatus } from "@cashsouk/types";

export const LEGAL_ACCEPTANCE_STATUS_OPTIONS: { value: LegalAcceptanceStatus; label: string }[] = [
  { value: "NOT_OPENED", label: "Not opened" },
  { value: "OPENED", label: "Opened" },
  { value: "ACCEPTED", label: "Accepted" },
];

export function formatLegalAcceptanceDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function legalAcceptanceStatusLabel(status: LegalAcceptanceStatus): string {
  const match = LEGAL_ACCEPTANCE_STATUS_OPTIONS.find((option) => option.value === status);
  return match?.label ?? status;
}

export function legalAcceptanceStatusToken(status: LegalAcceptanceStatus) {
  if (status === "ACCEPTED") return "success" as const;
  if (status === "OPENED") return "action" as const;
  return "neutral" as const;
}
