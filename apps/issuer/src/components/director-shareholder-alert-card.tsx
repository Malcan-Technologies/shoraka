"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { peopleHasPendingDirectorShareholderAml, type ApplicationPersonRow } from "@cashsouk/types";
import { useNotifications } from "@cashsouk/config";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const REJECTED_TYPE_ID = "director_shareholder_rejected";

type Props = {
  visiblePeople: ApplicationPersonRow[];
  /** When set, shows a short line if there is an unresolved admin reject notification for this org. */
  issuerOrganizationId?: string | null;
};

export function DirectorShareholderAlertCard({ visiblePeople, issuerOrganizationId }: Props) {
  const router = useRouter();
  const isEmpty = visiblePeople.length === 0;

  const hasPending = peopleHasPendingDirectorShareholderAml(visiblePeople);

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

  if (!isEmpty && !hasPending) return null;

  return (
    <Alert variant={isEmpty ? "default" : "destructive"} className="mb-4 w-full">
      <AlertTitle>
        {isEmpty
          ? "Directors/shareholders data is not available yet"
          : "Action required: directors/shareholders verification"}
      </AlertTitle>
      <AlertDescription>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0 space-y-2">
            {isEmpty ? (
              <p>
                We do not have visible directors/shareholders data yet. This does not mean
                verification is complete.
              </p>
            ) : (
              <p>
                Some directors or shareholders have not completed AML verification. Complete
                verification on your company profile before submitting an application.
              </p>
            )}
            {!isEmpty && showRejectLine ? (
              <p className="font-medium text-foreground">Some individuals require correction.</p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-9 shrink-0 rounded-lg"
            onClick={() => router.push("/profile")}
          >
            Go to profile
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
