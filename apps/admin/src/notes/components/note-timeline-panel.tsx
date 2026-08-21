"use client";

import {
  ArrowDownTrayIcon,
  ClockIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import type { NoteDetail, NoteEvent } from "@cashsouk/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AdminDetailCardHeader } from "@/components/admin-detail";
import {
  AdminTimelineDetailCard,
  AdminVerticalTimeline,
  AdminVerticalTimelineItem,
} from "@/components/admin-vertical-timeline";
import { useAdminS3DocumentViewDownload } from "@/hooks/use-admin-s3-document-view-download";
import { AdminActivityCsvExportButton } from "@/components/admin-activity-csv-export-button";
import { resolveAdminTimelineActorLabel } from "@/components/admin-timeline-originator";
import {
  formatNoteActivityEventLabel,
  noteEventToActivityCsvRow,
} from "@/notes/utils/note-activity-csv";
import {
  extractNoteTimelineDetails,
  noteDocumentFileName,
} from "@/notes/utils/note-timeline-details";

function extractS3Key(event: NoteEvent) {
  const s3Key = event.metadata?.s3Key;
  return typeof s3Key === "string" && s3Key.trim() ? s3Key : null;
}

function buildDownloadName(event: NoteEvent) {
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
  const csvRows = note.events.map(noteEventToActivityCsvRow);

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
            fileName={`${note.noteReference}-activity.csv`}
            rows={csvRows}
          />
        }
      />
      <CardContent className={totalCount === 0 ? "p-0" : undefined}>
        {totalCount === 0 ? (
          <div className="px-5 py-8 text-center text-ui text-muted-foreground">
            Note events, admin actions, and settlement activity will appear here.
          </div>
        ) : (
          <AdminVerticalTimeline>
            {note.events.map((event) => {
              const s3Key = extractS3Key(event);
              const { compact, prose } = extractNoteTimelineDetails(event);

              return (
                <AdminVerticalTimelineItem
                  key={event.id}
                  title={formatNoteActivityEventLabel(event.eventType)}
                  createdAt={event.createdAt}
                  actorLabel={resolveAdminTimelineActorLabel({
                    actorName: event.actorName,
                    actorUserId: event.actorUserId,
                    portal: event.portal,
                  })}
                  portal={event.portal}
                  compactDetails={compact}
                  prose={prose}
                  footer={
                    s3Key ? (
                      <AdminTimelineDetailCard>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-ui font-medium">Generated document</p>
                            <p className="truncate text-meta text-muted-foreground">
                              {noteDocumentFileName(s3Key)}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5"
                              onClick={() => handleViewDocument(s3Key)}
                              disabled={viewDocumentPending}
                            >
                              <DocumentTextIcon className="h-4 w-4" />
                              View PDF
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5"
                              onClick={() => handleDownloadDocument(s3Key, buildDownloadName(event))}
                              disabled={viewDocumentPending}
                            >
                              <ArrowDownTrayIcon className="h-4 w-4" />
                              Download
                            </Button>
                          </div>
                        </div>
                      </AdminTimelineDetailCard>
                    ) : null
                  }
                />
              );
            })}
          </AdminVerticalTimeline>
        )}
      </CardContent>
    </Card>
  );
}
