import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { ADMIN_ACTION_SURFACE_CLASS } from "@/lib/admin-status-token";
import { cn } from "@/lib/utils";

export function ProductRuleWarningNotice({ message }: { message: string }) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-xl border px-3 py-2 text-ui text-status-action-text",
        ADMIN_ACTION_SURFACE_CLASS
      )}
    >
      <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <p>{message}</p>
    </div>
  );
}
