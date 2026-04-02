import { cn } from "@cashsouk/ui";
import type { WithdrawReason } from "@cashsouk/types";
import { getStatusColorAndLabel } from "@cashsouk/config";

const ALLOWED_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "OFFER_SENT",
  "APPROVED",
  "REJECTED",
  "AMENDMENT_REQUESTED",
  "WITHDRAWN",
] as const;

/** Matches application management StatusBadge base. */
const BADGE_BASE =
  "inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold border";

export function StatusBadge({
  status,
  withdrawReason,
}: {
  status?: string;
  withdrawReason?: WithdrawReason;
}) {
  if (!status || !ALLOWED_STATUSES.includes(status as (typeof ALLOWED_STATUSES)[number])) {
    return null;
  }

  const { color, label } = getStatusColorAndLabel(status ?? "", withdrawReason, {
    issuerWithdrawPresentation: true,
  });

  return (
    <span className={cn(BADGE_BASE, color)}>
      {label}
    </span>
  );
}
