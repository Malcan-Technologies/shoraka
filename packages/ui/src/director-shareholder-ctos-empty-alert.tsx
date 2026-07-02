import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { cn } from "./lib/utils";

export interface DirectorShareholderCtosEmptyAlertProps {
  message: string;
  className?: string;
}

/** Shown when org-level CTOS exists but yielded no usable director/shareholder rows. */
export function DirectorShareholderCtosEmptyAlert({
  message,
  className,
}: DirectorShareholderCtosEmptyAlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100",
        className
      )}
    >
      <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p className="leading-relaxed">{message}</p>
    </div>
  );
}
