"use client";

import { format } from "date-fns";
import { toast } from "sonner";
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  DocumentDuplicateIcon,
} from "@heroicons/react/24/outline";
import type { NoteDocumentCatalogItem } from "@cashsouk/types";
import { Skeleton, StatusBadge, type StatusToken } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AdminDetailCardHeader } from "@/components/admin-detail";
import { useNoteDocuments } from "./use-note-documents";

function originToken(item: NoteDocumentCatalogItem): StatusToken {
  if (!item.available) return "neutral";
  if (item.origin === "canonical") return "success";
  return "submitted";
}

function NoteDocumentRow({
  item,
  viewPending,
  downloadPending,
  onView,
  onDownload,
}: {
  item: NoteDocumentCatalogItem;
  viewPending: boolean;
  downloadPending: boolean;
  onView: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-ui font-medium">{item.title}</p>
            <StatusBadge label={item.originLabel} status={originToken(item)} />
            {item.certificateCount != null && item.group === "facility-agreement-package" ? (
              <span className="text-meta text-muted-foreground">
                {item.certificateCount === 1
                  ? "1 certificate"
                  : `${item.certificateCount} certificates`}
              </span>
            ) : null}
          </div>
          <p className="text-meta text-muted-foreground">{item.availabilityReason}</p>
          {item.generatedAt ? (
            <p className="text-meta text-muted-foreground">
              Last compiled {format(new Date(item.generatedAt), "dd MMM yyyy, h:mm a")}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            disabled={!item.available || viewPending || downloadPending}
            aria-label={`View ${item.title}`}
            onClick={onView}
          >
            {viewPending ? (
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
            )}
            View
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            disabled={!item.available || viewPending || downloadPending}
            aria-label={`Download ${item.title}`}
            onClick={onDownload}
          >
            {downloadPending ? (
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowDownTrayIcon className="h-4 w-4" />
            )}
            Download
          </Button>
        </div>
      </div>
    </div>
  );
}

export function NoteDocumentsPanel({ noteId }: { noteId: string }) {
  const { catalogQuery, viewMutation, downloadMutation } = useNoteDocuments(noteId);
  const documents = catalogQuery.data?.documents ?? [];

  const run = async (
    item: NoteDocumentCatalogItem,
    action: "view" | "download"
  ) => {
    try {
      if (action === "view") await viewMutation.mutateAsync(item);
      else await downloadMutation.mutateAsync(item);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Document is not available");
    }
  };

  return (
    <Card className="rounded-2xl">
      <AdminDetailCardHeader
        icon={DocumentDuplicateIcon}
        title="Documents"
        description="Reference copies for this note. Compiled packages are not the digitally signed originals."
      />
      <CardContent className="space-y-3 pt-0">
        {catalogQuery.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ) : null}

        {catalogQuery.error ? (
          <p className="text-ui text-destructive">
            {catalogQuery.error instanceof Error
              ? catalogQuery.error.message
              : "Failed to load documents"}
          </p>
        ) : null}

        {!catalogQuery.isLoading && !catalogQuery.error
          ? documents.map((item) => (
              <NoteDocumentRow
                key={item.id}
                item={item}
                viewPending={viewMutation.isPending && viewMutation.variables?.id === item.id}
                downloadPending={
                  downloadMutation.isPending && downloadMutation.variables?.id === item.id
                }
                onView={() => void run(item, "view")}
                onDownload={() => void run(item, "download")}
              />
            ))
          : null}
      </CardContent>
    </Card>
  );
}
