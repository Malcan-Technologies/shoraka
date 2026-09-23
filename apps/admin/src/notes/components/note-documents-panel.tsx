"use client";

import { toast } from "sonner";
import type { AdminDocumentCatalogItem, NoteDocumentCatalogItem } from "@cashsouk/types";
import { AdminDocumentCatalogPanel } from "@/components/admin-detail";
import { useNoteDocuments } from "./use-note-documents";

export function NoteDocumentsPanel({ noteId }: { noteId: string }) {
  const { catalogQuery, viewMutation, downloadMutation } = useNoteDocuments(noteId);
  const documents = catalogQuery.data?.documents ?? [];

  const run = async (item: AdminDocumentCatalogItem, action: "view" | "download") => {
    try {
      const row = item as NoteDocumentCatalogItem;
      if (action === "view") await viewMutation.mutateAsync(row);
      else await downloadMutation.mutateAsync(row);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Document is not available");
    }
  };

  return (
    <AdminDocumentCatalogPanel
      description="Legal documents for this note."
      items={documents}
      isLoading={catalogQuery.isLoading}
      error={
        catalogQuery.error
          ? catalogQuery.error instanceof Error
            ? catalogQuery.error
            : new Error("Failed to load documents")
          : null
      }
      viewPendingId={
        viewMutation.isPending && viewMutation.variables ? viewMutation.variables.id : null
      }
      downloadPendingId={
        downloadMutation.isPending && downloadMutation.variables
          ? downloadMutation.variables.id
          : null
      }
      onView={(item) => void run(item, "view")}
      onDownload={(item) => void run(item, "download")}
    />
  );
}
