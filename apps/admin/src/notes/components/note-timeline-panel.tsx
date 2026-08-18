"use client";

import * as React from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowDownTrayIcon,
  ClipboardDocumentCheckIcon,
  ClockIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  GlobeAltIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import type { NoteDetail, NoteEvent } from "@cashsouk/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminS3DocumentViewDownload } from "@/hooks/use-admin-s3-document-view-download";
import { buildNoteActivityCsv, formatNoteActivityEventLabel } from "@/notes/utils/note-activity-csv";

function getEventIcon(eventType: string) {
  if (eventType.includes("LETTER")) return <DocumentTextIcon className="h-3.5 w-3.5" />;
  if (eventType.includes("DEFAULT") || eventType.includes("FAILED")) {
    return <ExclamationTriangleIcon className="h-3.5 w-3.5" />;
  }
  if (eventType.includes("APPROVED") || eventType.includes("POSTED")) {
    return <ClipboardDocumentCheckIcon className="h-3.5 w-3.5" />;
  }
  return <ClockIcon className="h-3.5 w-3.5" />;
}

function getEventDotColor(eventType: string) {
  if (eventType.includes("DEFAULT") || eventType.includes("FAILED")) {
    return "bg-red-500 border-red-100";
  }
  if (eventType.includes("LETTER")) {
    return "bg-amber-500 border-amber-100";
  }
  if (eventType.includes("APPROVED") || eventType.includes("POSTED") || eventType.includes("ACTIVATED")) {
    return "bg-emerald-500 border-emerald-100";
  }
  return "bg-primary border-primary/20";
}

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

function isProseMetadataField(key: string, value: string) {
  if (PROSE_METADATA_KEYS.has(key.toLowerCase())) return true;
  return value.length >= PROSE_VALUE_MIN_LENGTH;
}

type TimelineMetadataDetail = { key: string; label: string; value: string };

function extractS3Key(event: NoteEvent) {
  const s3Key = event.metadata?.s3Key;
  return typeof s3Key === "string" && s3Key.trim() ? s3Key : null;
}

function extractMetadataDetails(event: NoteEvent): {
  compact: TimelineMetadataDetail[];
  prose: TimelineMetadataDetail[];
} {
  const details = Object.entries(event.metadata ?? {})
    .filter(([key]) => key !== "s3Key")
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

function buildFileName(event: NoteEvent) {
  if (event.eventType === "ARREARS_LETTER_GENERATED") return `arrears-letter-${event.noteId}.pdf`;
  if (event.eventType === "SERVICE_FEE_TRUSTEE_LETTER_GENERATED") {
    return `settlement-trustee-letter-${event.noteId}.pdf`;
  }
  return `note-letter-${event.noteId}.pdf`;
}

export function NoteTimelinePanel({ note }: { note: NoteDetail }) {
  const { viewDocumentPending, handleViewDocument, handleDownloadDocument } =
    useAdminS3DocumentViewDownload();
  const totalCount = note.events.length;

  const handleExport = () => {
    const csv = buildNoteActivityCsv(note.events);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${note.noteReference}-activity.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <ClockIcon className="h-4 w-4 text-primary" />
          </div>
          <div>
            <CardTitle>Activity</CardTitle>
            <p className="mt-0.5 text-meta text-muted-foreground">
              {totalCount === 0
                ? "No activity logs yet"
                : `${totalCount} ${totalCount === 1 ? "event" : "events"}`}
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={handleExport} disabled={totalCount === 0}>
          Export CSV
        </Button>
      </CardHeader>
      <CardContent className={totalCount === 0 ? "p-0" : undefined}>
        {totalCount === 0 ? (
          <div className="px-5 py-8 text-center text-ui text-muted-foreground">
            Note events, admin actions, and settlement activity will appear here.
          </div>
        ) : (
          <div className="relative">
            <div className="absolute bottom-2 left-[5px] top-2 w-px bg-border" />
            <div className="space-y-5">
                  {note.events.map((event, index) => {
                    const s3Key = extractS3Key(event);
                    const { compact: compactMetadata, prose: proseMetadata } =
                      extractMetadataDetails(event);
                    const createdAt = new Date(event.createdAt);

                    return (
                      <div key={event.id} className="relative flex gap-3 pl-0">
                        <div
                          className={`relative z-10 mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full border-2 border-card ${getEventDotColor(event.eventType)} ${index === 0 ? "ring-2 ring-primary/20" : ""}`}
                        />
                        <div className="-mt-0.5 min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {getEventIcon(event.eventType)}
                            <span className="text-ui font-medium leading-tight">
                              {formatNoteActivityEventLabel(event.eventType)}
                            </span>
                          </div>

                          <div className="mt-1 flex items-center gap-2 text-meta text-muted-foreground">
                            <span className="inline-flex items-center gap-0.5">
                              <UserIcon className="h-3 w-3" />
                              {event.actorUserId ?? "System"}
                            </span>
                            {event.portal ? (
                              <span className="inline-flex items-center gap-0.5">
                                <GlobeAltIcon className="h-3 w-3" />
                                {event.portal}
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <p
                              className="text-meta text-muted-foreground"
                              title={format(createdAt, "PPpp")}
                            >
                              {formatDistanceToNow(createdAt, { addSuffix: true })}
                            </p>
                          </div>

                          {compactMetadata.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {compactMetadata.map((detail) => (
                                <Badge
                                  key={`${event.id}-${detail.key}`}
                                  variant="outline"
                                  className="h-auto min-h-5 max-w-full items-start whitespace-normal px-1.5 py-0.5 text-[10px] font-normal leading-snug"
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
                                  className="rounded-lg border bg-muted/30 px-2.5 py-2 text-[11px]"
                                >
                                  <div className="text-[11px] font-medium text-muted-foreground">
                                    {detail.label}
                                  </div>
                                  <p className="mt-0.5 break-words text-[11px] leading-snug text-foreground">
                                    {detail.value}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : null}

                          {s3Key ? (
                            <div className="mt-3 space-y-2 rounded-xl border bg-muted/20 p-4 text-[11px]">
                              <div className="font-medium">Generated document</div>
                              <div className="break-all font-mono text-[11px] text-muted-foreground">
                                {s3Key}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 gap-1.5 px-2 text-xs"
                                  onClick={() => handleViewDocument(s3Key)}
                                  disabled={viewDocumentPending}
                                >
                                  <DocumentTextIcon className="h-3.5 w-3.5" />
                                  View PDF
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 gap-1.5 px-2 text-xs"
                                  onClick={() => handleDownloadDocument(s3Key, buildFileName(event))}
                                  disabled={viewDocumentPending}
                                >
                                  <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                                  Download
                                </Button>
                              </div>
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

