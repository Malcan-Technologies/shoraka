import { cn } from "@cashsouk/ui";

const ALLOWED_STATUSES = ["DRAFT", "SUBMITTED", "APPROVED"] as const;
type Status = (typeof ALLOWED_STATUSES)[number];

export function StatusBadge({ status }: { status?: string }) {
  if (!ALLOWED_STATUSES.includes(status as Status)) {
    return null;
  }

  const styles: Record<Status, string> = {
    DRAFT: "bg-muted/50 text-muted-foreground border-border",
    SUBMITTED: "bg-amber-50 text-amber-800 border-amber-200",
    APPROVED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  };

  const safeStatus = status as Status;

  return (
    <span
      className={cn(
        "inline-flex items-center h-6 rounded-full border px-2.5 text-[11px] font-medium leading-none whitespace-nowrap",
        styles[safeStatus]
      )}
    >
      {safeStatus}
    </span>
  );
}
