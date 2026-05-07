"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  canManageDirectorShareholder,
  filterVisiblePeopleRows,
  hasActionableDirectorShareholder,
  normalizeRawStatus,
  type ApplicationPersonRow,
} from "@cashsouk/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  visiblePeople: ApplicationPersonRow[];
  /** When false, keep the card hidden (e.g. during onboarding). */
  enabled?: boolean;
  /** Pin to top of scroll container so copy stays visible while scrolling. */
  stickyTop?: boolean;
  className?: string;
  onGoToProfile?: (matchKey?: string) => void;
};

export function DirectorShareholderAlertCard({
  visiblePeople,
  enabled = true,
  stickyTop = false,
  className,
  onGoToProfile,
}: Props) {
  const router = useRouter();
  const visibleIndividuals = React.useMemo(
    () => filterVisiblePeopleRows(visiblePeople).filter((p) => p.entityType === "INDIVIDUAL"),
    [visiblePeople]
  );
  const hasPending = React.useMemo(() => hasActionableDirectorShareholder(visiblePeople), [visiblePeople]);
  const submitReadyCount = React.useMemo(
    () =>
      visibleIndividuals.filter((p) => {
        const onboarding = normalizeRawStatus(p.onboarding?.status);
        return onboarding === "WAIT_FOR_APPROVAL" || onboarding === "APPROVED";
      }).length,
    [visibleIndividuals]
  );
  const firstNeedAction = React.useMemo(() => {
    for (const p of visibleIndividuals) {
      if (canManageDirectorShareholder(p)) return p;
    }
    return undefined;
  }, [visibleIndividuals]);

  if (!enabled) return null;
  if (!hasPending) return null;

  const alert = (
    <Alert
      variant="attention"
      className={cn(
        "w-full sm:px-6 sm:py-5",
        "py-4",
        stickyTop ? "mb-0 shadow-sm md:shadow" : "mb-4 shadow-sm md:shadow"
      )}
      data-testid="director-shareholder-onboarding-banner"
    >
      <AlertTitle
        className={cn(
          "text-[17px] leading-7",
          "mb-2 font-bold text-primary"
        )}
      >
        {"Action required: directors and shareholders onboarding"}
      </AlertTitle>
      <AlertDescription>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="min-w-0 max-w-[70ch] flex-1 space-y-2">
            <p className="text-[17px] leading-7 text-foreground">
              Some directors or shareholders have not finished onboarding. Complete onboarding on your
              company profile before you submit an application.
            </p>
            {visibleIndividuals.length > 0 ? (
              <p className="text-sm text-muted-foreground">
                {submitReadyCount} of {visibleIndividuals.length} directors/shareholders completed
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="action"
              className="h-10 shrink-0 rounded-full px-5 text-sm font-semibold sm:self-center"
              onClick={() => {
                const matchKey = firstNeedAction?.matchKey;
                if (onGoToProfile) {
                  onGoToProfile(matchKey);
                  return;
                }
                const personQuery = matchKey ? `&person=${encodeURIComponent(matchKey)}` : "";
                router.push(`/profile?focus=directors${personQuery}`);
              }}
            >
              Go to Profile
            </Button>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );

  if (stickyTop) {
    return (
      <div
        className={
          "sticky top-0 z-30 -mx-3 border-b border-border bg-background px-3 py-3 sm:-mx-4 sm:px-4 " +
          (className ?? "").trim()
        }
      >
        {alert}
      </div>
    );
  }

  return <div className={className}>{alert}</div>;
}
