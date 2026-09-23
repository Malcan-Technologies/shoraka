"use client";

import { format } from "date-fns";
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  DocumentDuplicateIcon,
} from "@heroicons/react/24/outline";
import type { AdminDocumentCatalogItem } from "@cashsouk/types";
import { Skeleton } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AdminDetailCardHeader } from "./admin-detail-card-header";

function AdminDocumentCatalogRow({
  item,
  viewPending,
  downloadPending,
  onView,
  onDownload,
}: {
  item: AdminDocumentCatalogItem;
  viewPending: boolean;
  downloadPending: boolean;
  onView: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-ui font-medium">{item.title}</p>
          <p className="text-meta text-muted-foreground">{item.description}</p>
          {!item.available && item.unavailableHint ? (
            <p className="text-meta text-muted-foreground">{item.unavailableHint}</p>
          ) : null}
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

export function AdminDocumentCatalogPanel({
  description,
  items,
  isLoading,
  error,
  viewPendingId,
  downloadPendingId,
  onView,
  onDownload,
}: {
  description: string;
  items: AdminDocumentCatalogItem[];
  isLoading: boolean;
  error: Error | null;
  viewPendingId: string | null;
  downloadPendingId: string | null;
  onView: (item: AdminDocumentCatalogItem) => void;
  onDownload: (item: AdminDocumentCatalogItem) => void;
}) {
  return (
    <Card className="rounded-2xl">
      <AdminDetailCardHeader
        icon={DocumentDuplicateIcon}
        title="Documents"
        description={description}
      />
      <CardContent className="space-y-3 pt-0">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ) : null}

        {error ? <p className="text-ui text-destructive">{error.message}</p> : null}

        {!isLoading && !error
          ? items.map((item) => (
              <AdminDocumentCatalogRow
                key={item.id}
                item={item}
                viewPending={viewPendingId === item.id}
                downloadPending={downloadPendingId === item.id}
                onView={() => onView(item)}
                onDownload={() => onDownload(item)}
              />
            ))
          : null}
      </CardContent>
    </Card>
  );
}
