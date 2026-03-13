import { cn } from "@cashsouk/ui";
import { formatWithdrawLabel, WithdrawReason } from "@cashsouk/types";
import { STATUS_COLOR_MAP } from "@/app/(application-management)/applications/status";

const ALLOWED_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "OFFER_SENT",
  "APPROVED",
  "REJECTED",
  "AMENDMENT_REQUESTED",
  "WITHDRAWN",
] as const;
type Status = (typeof ALLOWED_STATUSES)[number];

const BADGE_FALLBACK = "border-slate-500/30 bg-slate-500/10 text-slate-600";

function getColorClass(status: Status, withdrawReason?: WithdrawReason): string {
  const key =
    status === "WITHDRAWN" && withdrawReason === "OFFER_EXPIRED"
      ? "withdrawn_offer_expired"
      : status.toLowerCase();
  const c = STATUS_COLOR_MAP[key];
  if (!c) return BADGE_FALLBACK;
  return `${c.border} ${c.bg} ${c.text}`;
}

export function StatusBadge({
  status,
  withdrawReason,
}: {
  status?: string;
  withdrawReason?: WithdrawReason;
}) {
  if (!ALLOWED_STATUSES.includes(status as Status)) {
    return null;
  }

  const safeStatus = status as Status;
  const label = safeStatus === "WITHDRAWN" ? formatWithdrawLabel(withdrawReason) : safeStatus;

  return (
    <span
      className={cn(
        "inline-flex items-center h-6 rounded-full border px-2.5 text-[11px] font-medium leading-none whitespace-nowrap",
        getColorClass(safeStatus, withdrawReason)
      )}
    >
      {label}
    </span>
  );
}
