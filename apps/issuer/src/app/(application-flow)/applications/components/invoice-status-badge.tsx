import { StatusBadge as UiStatusBadge } from "@cashsouk/ui";
import type { WithdrawReason } from "@cashsouk/types";
import { getStatusColorAndLabel, getUserPortalStatusToken } from "@cashsouk/config";

const ALLOWED_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "OFFER_SENT",
  "APPROVED",
  "REJECTED",
  "AMENDMENT_REQUESTED",
  "WITHDRAWN",
] as const;

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

  const { label } = getStatusColorAndLabel(status, withdrawReason, {
    issuerWithdrawPresentation: true,
  });

  return <UiStatusBadge label={label} status={getUserPortalStatusToken(status)} />;
}
