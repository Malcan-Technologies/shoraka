"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ApplicationPersonRow } from "@cashsouk/types";
import { useNotifications } from "@cashsouk/config";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isReadyOnboardingStatus } from "@/lib/director-shareholder-onboarding-ui";

const REJECTED_TYPE_ID = "director_shareholder_rejected";

type Props = {
  visiblePeople: ApplicationPersonRow[];
  /** When set, shows a short line if there is an unresolved admin reject notification for this org. */
  issuerOrganizationId?: string | null;
  /** When false, keep the card hidden (e.g. during onboarding). */
  enabled?: boolean;
  /** Pin to top of scroll container so copy stays visible while scrolling. */
  stickyTop?: boolean;
  className?: string;
};

export function DirectorShareholderAlertCard({
  visiblePeople,
  issuerOrganizationId,
  enabled = true,
  stickyTop = false,
  className,
}: Props) {
  const router = useRouter();
  const visibleIndividualPeople = React.useMemo(
    () => visiblePeople.filter((p) => p.entityType === "INDIVIDUAL"),
    [visiblePeople]
  );
  const isEmpty = visibleIndividualPeople.length === 0;

  const hasPending = visibleIndividualPeople.some((p) => !isReadyOnboardingStatus(p.onboarding?.status));

  const { notifications } = useNotifications({ limit: 30 });
  const showRejectLine = React.useMemo(() => {
    const orgId = issuerOrganizationId?.trim();
    if (!orgId) return false;
    return (notifications as ReadonlyArray<Record<string, unknown>>).some((n) => {
      const type = n.notification_type as { id?: string } | undefined;
      const meta = n.metadata as { issuerOrganizationId?: string } | undefined;
      if (type?.id !== REJECTED_TYPE_ID) return false;
      if (meta?.issuerOrganizationId !== orgId) return false;
      if (n.resolved_at) return false;
      return true;
    });
  }, [notifications, issuerOrganizationId]);

  if (!enabled) return null;
  if (!isEmpty && !hasPending) return null;

  const alert = (
    <Alert
      variant={isEmpty ? "default" : "attention"}
      className={cn(
        "w-full sm:px-6 sm:py-5",
        isEmpty ? "rounded-2xl border-2 border-border bg-muted/30 py-4" : "py-4",
        stickyTop ? "mb-0 shadow-sm md:shadow" : "mb-4 shadow-sm md:shadow"
      )}
      data-testid="director-shareholder-onboarding-banner"
    >
      <AlertTitle
        className={cn(
          "text-[17px] leading-7",
          isEmpty ? "font-semibold text-foreground" : "mb-2 font-bold text-primary"
        )}
      >
        {isEmpty
          ? "Directors and shareholders data is not available yet"
          : "Action required: directors and shareholders onboarding"}
      </AlertTitle>
      <AlertDescription>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="min-w-0 max-w-[70ch] flex-1 space-y-2">
            {isEmpty ? (
              <p className="text-[17px] leading-7 text-muted-foreground">
                We do not have visible directors or shareholders yet. This does not mean verification
                is complete.
              </p>
            ) : (
              <p className="text-[17px] leading-7 text-foreground">
                Some directors or shareholders have not finished onboarding. Complete onboarding on
                your company profile before you submit an application.
              </p>
            )}
            {!isEmpty && showRejectLine ? (
              <p className="text-[17px] leading-7 font-medium text-primary">
                Some individuals require correction.
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="action"
            className="h-10 shrink-0 rounded-full px-5 text-sm font-semibold sm:self-center"
            onClick={() => router.push("/profile")}
          >
            Go to Profile
          </Button>
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
