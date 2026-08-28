"use client";

import { ClockIcon } from "@heroicons/react/24/outline";
import type { AdminContractActivityEvent, AdminContractDetail } from "@cashsouk/types";
import { formatContractReference } from "@cashsouk/types";
import { Card, CardContent } from "@/components/ui/card";
import { AdminDetailCardHeader } from "@/components/admin-detail";
import { AdminActivityCsvExportButton } from "@/components/admin-activity-csv-export-button";
import {
  AdminVerticalTimeline,
  AdminVerticalTimelineItem,
} from "@/components/admin-vertical-timeline";
import { resolveAdminTimelineActorLabel } from "@/components/admin-timeline-originator";
import {
  contractEventToActivityCsvRow,
  formatContractActivityEventLabel,
} from "@/contracts/utils/contract-activity-csv";
import { AuditDetailDrawer } from "@/components/audit/audit-detail-drawer";
import { contractEventToAuditDetail } from "@/components/audit/audit-adapters";
import { useState } from "react";

function formatMetadataLabel(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function formatMetadataValue(value: unknown) {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

const PROSE_METADATA_KEYS = new Set(["message", "reason", "description", "remark", "note"]);
const COMPACT_METADATA_LIMIT = 4;
const PROSE_VALUE_MIN_LENGTH = 48;
const HIDDEN_METADATA_KEYS = new Set([
  "actorName",
  "actor_name",
  "actorUserId",
  "actor_user_id",
  "applicationId",
  "application_id",
  "entityId",
  "userId",
  "user_id",
  "id",
  "correlationId",
]);

function isProseMetadataField(key: string, value: string) {
  if (PROSE_METADATA_KEYS.has(key.toLowerCase())) return true;
  return value.length >= PROSE_VALUE_MIN_LENGTH;
}

type TimelineMetadataDetail = { key: string; label: string; value: string };

function extractMetadataDetails(event: AdminContractActivityEvent): {
  compact: TimelineMetadataDetail[];
  prose: TimelineMetadataDetail[];
} {
  const details = Object.entries(event.metadata ?? {})
    .filter(([key]) => !HIDDEN_METADATA_KEYS.has(key))
    .map(([key, value]) => ({
      key,
      label: formatMetadataLabel(key),
      value: formatMetadataValue(value),
    }))
    .filter((detail): detail is TimelineMetadataDetail => Boolean(detail.value));

  const compact: TimelineMetadataDetail[] = [];
  const prose: TimelineMetadataDetail[] = [];

  for (const detail of details) {
    if (isProseMetadataField(detail.key, detail.value)) {
      prose.push(detail);
    } else {
      compact.push(detail);
    }
  }

  return {
    compact: compact.slice(0, COMPACT_METADATA_LIMIT),
    prose,
  };
}

export function ContractActivityPanel({ contract }: { contract: AdminContractDetail }) {
  const events = contract.activity ?? [];
  const totalCount = events.length;
  const [selectedEvent, setSelectedEvent] = useState<AdminContractActivityEvent | null>(null);
  const contractReference = formatContractReference({
    displayReference: contract.displayReference,
    businessNumber: contract.contractNumber,
    id: contract.id,
  });

  const csvRows = events.map(contractEventToActivityCsvRow);

  return (
    <Card className="rounded-2xl">
      <AdminDetailCardHeader
        icon={ClockIcon}
        title="Activity"
        description={
          totalCount === 0
            ? "No activity logs yet"
            : `${totalCount} ${totalCount === 1 ? "event" : "events"}`
        }
        actions={
          <AdminActivityCsvExportButton
            fileName={`${contractReference}-activity.csv`}
            rows={csvRows}
          />
        }
      />
      <CardContent className={totalCount === 0 ? "p-0" : undefined}>
        {totalCount === 0 ? (
          <div className="px-5 py-8 text-center text-ui text-muted-foreground">
            Offer, signing, and originating-application events will appear here.
          </div>
        ) : (
          <AdminVerticalTimeline>
            {events.map((event) => {
              const { compact: compactMetadata, prose: proseMetadata } =
                extractMetadataDetails(event);
              const actorLabel = resolveAdminTimelineActorLabel({
                actorName: event.actorName,
                actorUserId: event.actorUserId,
                portal: event.portal,
              });
              const remark = event.remark?.trim() || null;

              return (
                <AdminVerticalTimelineItem
                  key={event.id}
                  title={formatContractActivityEventLabel(event.eventType)}
                  description={remark}
                  createdAt={event.createdAt}
                  actorLabel={actorLabel}
                  portal={event.portal}
                  compactDetails={compactMetadata}
                  prose={proseMetadata}
                  onViewDetails={() => setSelectedEvent(event)}
                />
              );
            })}
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
            ? contractEventToAuditDetail(
                selectedEvent,
                formatContractActivityEventLabel(selectedEvent.eventType)
              )
            : null
        }
      />
    </Card>
  );
}
