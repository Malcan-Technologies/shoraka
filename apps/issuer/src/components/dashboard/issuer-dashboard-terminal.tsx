"use client";

import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { Card, CardContent } from "@cashsouk/ui";

export function IssuerDashboardRejected() {
  return (
    <Card className="rounded-2xl border-status-rejected-text/30 bg-status-rejected-bg shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-status-rejected-bg">
            <ExclamationTriangleIcon className="h-5 w-5 text-status-rejected-text" />
          </div>
          <div>
            <h3 className="text-section-title text-status-rejected-text">Onboarding rejected</h3>
            <p className="mt-2 text-ui text-muted-foreground">
              Your onboarding application was rejected. If you believe this was a mistake, contact
              support to request a review.
            </p>
            <p className="mt-3 text-ui text-muted-foreground">
              Email:{" "}
              <a href="mailto:support@cashsouk.my" className="text-primary hover:underline">
                support@cashsouk.my
              </a>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function IssuerDashboardPendingAmendment() {
  return (
    <Card className="rounded-2xl border-status-action-text/30 bg-status-action-bg shadow-sm">
      <CardContent className="p-6">
        <h3 className="text-section-title text-status-action-text">Changes requested</h3>
        <p className="mt-2 text-ui text-muted-foreground">
          Your onboarding was sent back for updates. Complete the updated submission so our team can
          review it again.
        </p>
      </CardContent>
    </Card>
  );
}
