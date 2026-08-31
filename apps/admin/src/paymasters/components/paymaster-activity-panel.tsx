"use client";

import { useState } from "react";
import Link from "next/link";
import { ClockIcon } from "@heroicons/react/24/outline";
import { formatNamedEntityDisplay, type PaymasterActivityEvent } from "@cashsouk/types";
import { Card, CardContent } from "@/components/ui/card";
import { AdminDetailCardHeader } from "@/components/admin-detail";
import { AdminActivityCsvExportButton } from "@/components/admin-activity-csv-export-button";
import {
  AdminTimelineDetailCard,
  AdminVerticalTimeline,
  AdminVerticalTimelineItem,
  AdminVerticalTimelineSkeleton,
} from "@/components/admin-vertical-timeline";
import { resolveAdminTimelineActorLabel } from "@/components/admin-timeline-originator";
import { AuditDetailDrawer } from "@/components/audit/audit-detail-drawer";
import { paymasterActivityToAuditDetail } from "@/components/audit/audit-adapters";
import { formatAuditEventLabel } from "@/components/audit/audit-presentation";
import { applicationHref, orgHref } from "@/lib/admin-directory-hrefs";
import { useAdminPaymasterActivity } from "@/paymasters/hooks/use-paymasters";
import { paymasterActivityToCsvRow } from "@/paymasters/utils/paymaster-activity-csv";
import {
  paymasterActivityCompactDetails,
  paymasterActivityDescription,
} from "@/paymasters/utils/paymaster-activity-presentation";

function relatedRecordLinks(event: PaymasterActivityEvent) {
  const issuerLabel =
    event.issuerName || event.issuerDisplayReference
      ? formatNamedEntityDisplay(event.issuerName, event.issuerDisplayReference)
      : null;
  const applicationLabel = event.applicationDisplayReference || event.applicationId;
  const issuerHref = event.issuerOrganizationId
    ? orgHref("issuer", event.issuerOrganizationId)
    : null;
  const appHref =
    event.applicationId && event.applicationProductId
      ? applicationHref(event.applicationProductId, event.applicationId)
      : null;

  if (!issuerLabel && !applicationLabel) return null;

  return (
    <AdminTimelineDetailCard>
      <div className="space-y-1 text-ui">
        {issuerLabel ? (
          <p>
            <span className="text-muted-foreground">Issuer </span>
            {issuerHref ? (
              <Link href={issuerHref} className="text-primary underline-offset-4 hover:underline">
                {issuerLabel}
              </Link>
            ) : (
              <span>{issuerLabel}</span>
            )}
          </p>
        ) : null}
        {applicationLabel ? (
          <p>
            <span className="text-muted-foreground">Application </span>
            {appHref ? (
              <Link href={appHref} className="text-primary underline-offset-4 hover:underline">
                {applicationLabel}
              </Link>
            ) : (
              <span>{applicationLabel}</span>
            )}
          </p>
        ) : null}
      </div>
    </AdminTimelineDetailCard>
  );
}

export function PaymasterActivityPanel({
  paymasterId,
  legalName,
}: {
  paymasterId: string;
  legalName: string;
}) {
  const { data, isLoading, error } = useAdminPaymasterActivity(paymasterId);
  const events = data ?? [];
  const totalCount = events.length;
  const [selectedEvent, setSelectedEvent] = useState<PaymasterActivityEvent | null>(null);
  const fileName = `${legalName.trim() || paymasterId}-paymaster-activity.csv`;

  return (
    <Card className="rounded-2xl">
      <AdminDetailCardHeader
        icon={ClockIcon}
        title="Activity"
        description={
          isLoading
            ? "Loading identity history"
            : totalCount === 0
              ? "No activity logs yet"
              : `${totalCount} ${totalCount === 1 ? "event" : "events"}`
        }
        actions={
          <AdminActivityCsvExportButton
            fileName={fileName}
            rows={events.map(paymasterActivityToCsvRow)}
            disabled={totalCount === 0}
          />
        }
      />
      <CardContent className={totalCount === 0 && !isLoading ? "p-0" : undefined}>
        {isLoading ? (
          <AdminVerticalTimelineSkeleton />
        ) : error ? (
          <p className="text-ui text-destructive">
            {error instanceof Error ? error.message : "Failed to load Paymaster activity"}
          </p>
        ) : totalCount === 0 ? (
          <div className="px-5 py-8 text-center text-ui text-muted-foreground">
            Paymaster created, issuer-link, and identity-verified events will appear here.
          </div>
        ) : (
          <AdminVerticalTimeline>
            {events.map((event) => (
              <AdminVerticalTimelineItem
                key={event.id}
                title={formatAuditEventLabel(event.eventType)}
                description={paymasterActivityDescription(event)}
                createdAt={event.createdAt}
                actorLabel={resolveAdminTimelineActorLabel({
                  actorName: event.actorName,
                  actorUserId: event.actorUserId,
                  portal: event.portal,
                })}
                portal={event.portal}
                compactDetails={paymasterActivityCompactDetails(event)}
                onViewDetails={() => setSelectedEvent(event)}
                footer={relatedRecordLinks(event)}
              />
            ))}
          </AdminVerticalTimeline>
        )}
      </CardContent>
      <AuditDetailDrawer
        open={selectedEvent != null}
        onOpenChange={(open) => {
          if (!open) setSelectedEvent(null);
        }}
        record={
          selectedEvent
            ? paymasterActivityToAuditDetail(
                selectedEvent,
                formatAuditEventLabel(selectedEvent.eventType)
              )
            : null
        }
      />
    </Card>
  );
}
