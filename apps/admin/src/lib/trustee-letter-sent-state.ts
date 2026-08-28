import { formatAuditDateTime } from "@/components/audit/audit-presentation";

export const TRUSTEE_EMAIL_DELIVERED_LABEL = "Email delivered to Trustee";

export function formatTrusteeInstructionEmailedCopy(
  sentAt: string | null | undefined
): string | null {
  if (!sentAt) return null;
  const date = new Date(sentAt);
  if (Number.isNaN(date.getTime())) return null;
  return `${TRUSTEE_EMAIL_DELIVERED_LABEL} on ${formatAuditDateTime(date)}`;
}

export function formatTrusteeInstructionEmailedAt(
  sentAt: string | null | undefined
): string | null {
  if (!sentAt) return null;
  const date = new Date(sentAt);
  if (Number.isNaN(date.getTime())) return null;
  return formatAuditDateTime(date);
}
