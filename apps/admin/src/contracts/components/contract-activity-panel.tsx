"use client";

import * as React from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  ClockIcon,
  DocumentTextIcon,
  GlobeAltIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import type { AdminContractActivityEvent, AdminContractDetail } from "@cashsouk/types";
import { formatContractReference } from "@cashsouk/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AdminDetailCardHeader } from "@/components/admin-detail";
import {
  buildContractActivityCsv,
  formatContractActivityEventLabel,
} from "@/contracts/utils/contract-activity-csv";

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
const COMPACT_METADATA_LIMIT = 8;
const PROSE_VALUE_MIN_LENGTH = 48;
const HIDDEN_METADATA_KEYS = new Set(["actorName", "actor_name"]);

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

function getEventDotClass(eventType: string) {
  if (
    eventType.includes("REJECTED") ||
    eventType.includes("FAILED") ||
    eventType.includes("VOIDED") ||
    eventType.includes("EXPIRED") ||
    eventType.includes("WITHDRAWN")
  ) {
    return "bg-status-rejected-text";
  }
  if (eventType.includes("AMENDMENT") || eventType.includes("PENDING")) {
    return "bg-status-action-text";
  }
  if (
    eventType.includes("APPROVED") ||
    eventType.includes("ACCEPTED") ||
    eventType.includes("COMPLETED") ||
    eventType.includes("SIGNED")
  ) {
    return "bg-status-success-text";
  }
  return "bg-status-submitted-text";
}

export function ContractActivityPanel({ contract }: { contract: AdminContractDetail }) {
  const events = contract.activity ?? [];
  const totalCount = events.length;
  const contractReference = formatContractReference({
    displayReference: contract.displayReference,
    businessNumber: contract.contractNumber,
    id: contract.id,
  });

  const handleExport = () => {
    const csv = buildContractActivityCsv(events);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${contractReference}-activity.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

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
          <Button size="sm" variant="outline" onClick={handleExport} disabled={totalCount === 0}>
            Export CSV
          </Button>
        }
      />
      <CardContent className={totalCount === 0 ? "p-0" : undefined}>
        {totalCount === 0 ? (
          <div className="px-5 py-8 text-center text-ui text-muted-foreground">
            Offer, signing, and originating-application events will appear here.
          </div>
        ) : (
          <div className="relative">
            <div className="absolute bottom-2 left-[5px] top-2 w-px bg-border" />
            <div className="space-y-5">
              {events.map((event, index) => {
                const { compact: compactMetadata, prose: proseMetadata } =
                  extractMetadataDetails(event);
                const createdAt = new Date(event.createdAt);
                const actorLabel = event.actorName?.trim() || event.actorUserId || "System";

                return (
                  <div key={event.id} className="relative flex gap-3 pl-0">
                    <div
                      className={`relative z-10 mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full border-2 border-card ${getEventDotClass(event.eventType)} ${index === 0 ? "ring-2 ring-primary/20" : ""}`}
                    />
                    <div className="-mt-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <DocumentTextIcon className="h-3.5 w-3.5" />
                        <span className="text-ui font-medium leading-tight">
                          {formatContractActivityEventLabel(event.eventType)}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center gap-2 text-meta text-muted-foreground">
                        <span className="inline-flex items-center gap-0.5">
                          <UserIcon className="h-3 w-3" />
                          {actorLabel}
                        </span>
                        {event.portal ? (
                          <span className="inline-flex items-center gap-0.5">
                            <GlobeAltIcon className="h-3 w-3" />
                            {event.portal}
                          </span>
                        ) : null}
                      </div>

                      <p
                        className="mt-1 text-meta text-muted-foreground"
                        title={format(createdAt, "PPpp")}
                      >
                        {formatDistanceToNow(createdAt, { addSuffix: true })}
                      </p>

                      {event.remark ? (
                        <div className="mt-2 rounded-lg border bg-muted/30 px-2.5 py-2">
                          <div className="text-meta font-medium text-muted-foreground">Remark</div>
                          <p className="mt-0.5 break-words text-meta leading-snug text-foreground">
                            {event.remark}
                          </p>
                        </div>
                      ) : null}

                      {compactMetadata.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {compactMetadata.map((detail) => (
                            <Badge
                              key={`${event.id}-${detail.key}`}
                              variant="outline"
                              className="h-auto min-h-5 max-w-full items-start whitespace-normal px-1.5 py-0.5 text-meta font-normal leading-snug"
                            >
                              <span className="mr-0.5 shrink-0 text-muted-foreground">
                                {detail.label}:
                              </span>
                              <span className="break-words">{detail.value}</span>
                            </Badge>
                          ))}
                        </div>
                      ) : null}

                      {proseMetadata.length > 0 ? (
                        <div className="mt-2 space-y-2">
                          {proseMetadata.map((detail) => (
                            <div
                              key={`${event.id}-${detail.key}-prose`}
                              className="rounded-lg border bg-muted/30 px-2.5 py-2"
                            >
                              <div className="text-meta font-medium text-muted-foreground">
                                {detail.label}
                              </div>
                              <p className="mt-0.5 break-words text-meta leading-snug text-foreground">
                                {detail.value}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
