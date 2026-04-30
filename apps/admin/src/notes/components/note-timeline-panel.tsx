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
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAdminS3DocumentViewDownload } from "@/hooks/use-admin-s3-document-view-download";

function formatEventLabel(eventType: string) {
  const labels: Record<string, string> = {
    NOTE_CREATED: "Note created",
    NOTE_DRAFT_UPDATED: "Draft updated",
    NOTE_PUBLISHED: "Published to marketplace",
    NOTE_UNPUBLISHED: "Unpublished from marketplace",
    NOTE_FUNDING_CLOSED: "Funding closed",
    NOTE_FUNDING_FAILED: "Funding failed",
    NOTE_ACTIVATED: "Note activated",
    PAYMENT_RECORDED: "Payment recorded",
    SETTLEMENT_PREVIEWED: "Settlement previewed",
    SETTLEMENT_APPROVED: "Settlement approved",
    SETTLEMENT_POSTED: "Settlement posted",
    LATE_CHARGE_APPROVED: "Late charge approved",
    ARREARS_LETTER_GENERATED: "Arrears letter generated",
    DEFAULT_LETTER_GENERATED: "Default letter generated",
    NOTE_DEFAULT_MARKED: "Default marked",
  };

  return labels[eventType] ?? eventType.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

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

function extractS3Key(event: NoteEvent) {
  const s3Key = event.metadata?.s3Key;
  return typeof s3Key === "string" && s3Key.trim() ? s3Key : null;
}

function extractMetadataDetails(event: NoteEvent) {
  return Object.entries(event.metadata ?? {})
    .filter(([key]) => key !== "s3Key")
    .map(([key, value]) => ({ label: formatMetadataLabel(key), value: formatMetadataValue(value) }))
    .filter((detail): detail is { label: string; value: string } => Boolean(detail.value))
    .slice(0, 6);
}

function buildFileName(event: NoteEvent) {
  const prefix = event.eventType === "ARREARS_LETTER_GENERATED" ? "arrears-letter" : "note-letter";
  return `${prefix}-${event.noteId}.pdf`;
}

export function NoteTimelinePanel({ note }: { note: NoteDetail }) {
  const { viewDocumentPending, handleViewDocument, handleDownloadDocument } =
    useAdminS3DocumentViewDownload();
  const totalCount = note.events.length;

  return (
    <Card className="flex flex-col overflow-hidden rounded-2xl">
      <CardHeader className="shrink-0 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardDocumentCheckIcon className="h-5 w-5 text-destructive" />
            <CardTitle className="text-base font-semibold">Activity Timeline</CardTitle>
          </div>
          {totalCount > 0 ? (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              {totalCount}
            </Badge>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Note events, admin actions, generated letters, and settlement activity
        </p>
      </CardHeader>
      <CardContent className="min-h-0 overflow-hidden !px-0">
        {totalCount === 0 ? (
          <div className="px-6 py-8 pb-12 text-center text-sm text-muted-foreground">
            No activity logs found
          </div>
        ) : (
          <ScrollArea className="overflow-auto">
            <div className="px-6">
              <div className="relative">
                <div className="absolute bottom-2 left-[5px] top-2 w-px bg-border" />
                <div className="space-y-5">
                  {note.events.map((event, index) => {
                    const s3Key = extractS3Key(event);
                    const metadataDetails = extractMetadataDetails(event);
                    const createdAt = new Date(event.createdAt);

                    return (
                      <div key={event.id} className="relative flex gap-3 pl-0">
                        <div
                          className={`relative z-10 mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full border-2 border-card ${getEventDotColor(event.eventType)} ${index === 0 ? "ring-2 ring-primary/20" : ""}`}
                        />
                        <div className="-mt-0.5 min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {getEventIcon(event.eventType)}
                            <span className="text-sm font-medium leading-tight">
                              {formatEventLabel(event.eventType)}
                            </span>
                          </div>

                          <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground/70">
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
                              className="text-[11px] text-muted-foreground/70"
                              title={format(createdAt, "PPpp")}
                            >
                              {formatDistanceToNow(createdAt, { addSuffix: true })}
                            </p>
                          </div>

                          {metadataDetails.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {metadataDetails.map((detail) => (
                                <Badge
                                  key={`${event.id}-${detail.label}`}
                                  variant="outline"
                                  className="h-5 px-1.5 text-[10px] font-normal"
                                >
                                  <span className="mr-0.5 text-muted-foreground">{detail.label}:</span>
                                  {detail.value}
                                </Badge>
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
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

