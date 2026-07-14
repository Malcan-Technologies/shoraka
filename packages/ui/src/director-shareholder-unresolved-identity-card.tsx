import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { cn } from "./lib/utils";

export interface DirectorShareholderUnresolvedIdentityCardProps {
  name: string | null | undefined;
  role: string | null | undefined;
  sharePercentage?: number | null;
  eodRequestId?: string | null;
  onboardingStatus?: string | null;
  className?: string;
}

/**
 * Compact warning card when RegTank did not provide a government ID for a
 * director/shareholder. Display-only; identity is unresolved and must not be merged.
 */
export function DirectorShareholderUnresolvedIdentityCard({
  name,
  role,
  sharePercentage,
  eodRequestId,
  onboardingStatus,
  className,
}: DirectorShareholderUnresolvedIdentityCardProps) {
  const shareLabel =
    typeof sharePercentage === "number" && Number.isFinite(sharePercentage)
      ? `${sharePercentage}%`
      : null;

  return (
    <div
      role="alert"
      className={cn(
        "rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100",
        className
      )}
    >
      <div className="flex gap-3">
        <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div className="min-w-0 space-y-2">
          <div>
            <p className="font-medium leading-snug">Identity could not be matched</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-900/90 dark:text-amber-100/90">
              RegTank did not provide a government ID for this director or shareholder. Review the
              RegTank record before continuing.
            </p>
          </div>
          <dl className="grid gap-1 text-xs">
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-amber-900/70 dark:text-amber-100/70">Name</dt>
              <dd className="font-medium">{name?.trim() || "—"}</dd>
            </div>
            {role?.trim() ? (
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-amber-900/70 dark:text-amber-100/70">Role</dt>
                <dd>{role}</dd>
              </div>
            ) : null}
            {shareLabel ? (
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-amber-900/70 dark:text-amber-100/70">Share</dt>
                <dd>{shareLabel}</dd>
              </div>
            ) : null}
            {eodRequestId?.trim() ? (
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-amber-900/70 dark:text-amber-100/70">EOD</dt>
                <dd className="font-mono break-all">{eodRequestId}</dd>
              </div>
            ) : null}
            {onboardingStatus?.trim() ? (
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-amber-900/70 dark:text-amber-100/70">Onboarding</dt>
                <dd>{onboardingStatus}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>
    </div>
  );
}
