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
import { Button } from "./components/button";
import { cn } from "./lib/utils";
import {
  ISSUER_DIRECTOR_SHAREHOLDER_ALERT_COPY,
  type DirectorShareholderAlertCopy,
} from "./director-shareholder-alert-copy";

export type DirectorShareholderAlertCardProps = {
  visiblePeople: ApplicationPersonRow[];
  /** When false, keep the card hidden (e.g. during onboarding). */
  enabled?: boolean;
  /** Pin to top of scroll container so copy stays visible while scrolling. */
  stickyTop?: boolean;
  className?: string;
  copy?: DirectorShareholderAlertCopy;
  onGoToProfile?: (matchKey?: string) => void;
  /** Default `/profile?focus=directors` when `onGoToProfile` is not provided. */
  profileFocusPath?: string;
};

export function DirectorShareholderAlertCard({
  visiblePeople,
  enabled = true,
  stickyTop = false,
  className,
  copy = ISSUER_DIRECTOR_SHAREHOLDER_ALERT_COPY,
  onGoToProfile,
  profileFocusPath = "/profile?focus=directors",
}: DirectorShareholderAlertCardProps) {
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
    <div
      role="alert"
      data-testid="director-shareholder-onboarding-banner"
      className={cn(
        "relative w-full border-2 border-primary/45 bg-primary/10 text-foreground shadow-sm",
        "rounded-2xl [&_[data-slot=alert-title]]:text-primary [&_[data-slot=alert-description]]:text-foreground",
        "w-full sm:px-6 sm:py-5 py-4",
        stickyTop ? "mb-0 shadow-sm md:shadow" : "mb-4 shadow-sm md:shadow"
      )}
    >
      <div
        data-slot="alert-title"
        className={cn("text-[17px] leading-7 mb-2 font-bold text-primary")}
      >
        {copy.title}
      </div>
      <div data-slot="alert-description" className="text-[15px] leading-7 [&_p]:leading-7 [&_p]:text-[17px]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="min-w-0 max-w-[70ch] flex-1 space-y-2">
            <p className="text-[17px] leading-7 text-foreground">{copy.description}</p>
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
                router.push(`${profileFocusPath}${personQuery}`);
              }}
            >
              {copy.ctaLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
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
