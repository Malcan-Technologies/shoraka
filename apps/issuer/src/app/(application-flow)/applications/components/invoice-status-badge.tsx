import { cn } from "@cashsouk/ui";
import { formatWithdrawLabel, WithdrawReason } from "@cashsouk/types";

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

  const styles: Record<Status, string> = {
    DRAFT: "bg-muted/50 text-muted-foreground border-border",
    SUBMITTED: "bg-amber-50 text-amber-800 border-amber-200",
    OFFER_SENT: "bg-blue-50 text-blue-800 border-blue-200",
    APPROVED: "bg-emerald-50 text-emerald-800 border-emerald-200",
    REJECTED: "bg-red-50 text-red-800 border-red-200",
    AMENDMENT_REQUESTED: "bg-amber-50 text-amber-800 border-amber-200",
    WITHDRAWN: "bg-slate-100 text-slate-700 border-slate-300",
  };

  const safeStatus = status as Status;
  const label = safeStatus === "WITHDRAWN" ? formatWithdrawLabel(withdrawReason) : safeStatus;

  return (
    <span
      className={cn(
        "inline-flex items-center h-6 rounded-full border px-2.5 text-[11px] font-medium leading-none whitespace-nowrap",
        styles[safeStatus]
      )}
    >
      {label}
    </span>
  );
}
