import { format } from "date-fns";

export const TRUSTEE_EMAIL_DELIVERED_LABEL = "Email delivered to Trustee";

export function formatTrusteeInstructionEmailedCopy(
  sentAt: string | null | undefined
): string | null {
  if (!sentAt) return null;
  const date = new Date(sentAt);
  if (Number.isNaN(date.getTime())) return null;
  return `${TRUSTEE_EMAIL_DELIVERED_LABEL} on ${format(date, "dd MMM yyyy, h:mm a")}`;
}

export function formatTrusteeInstructionEmailedAt(
  sentAt: string | null | undefined
): string | null {
  if (!sentAt) return null;
  const date = new Date(sentAt);
  if (Number.isNaN(date.getTime())) return null;
  return format(date, "dd MMM yyyy, h:mm a");
}
