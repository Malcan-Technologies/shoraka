"use client";

import { toast } from "sonner";
import type { AdminDocumentCatalogItem, FacilityDocumentCatalogItem } from "@cashsouk/types";
import { AdminDocumentCatalogPanel } from "@/components/admin-detail";
import { useFacilityDocuments } from "@/contracts/hooks/use-facility-documents";

export function FacilityDocumentsPanel({
  facilityId,
  isStandaloneHolder,
}: {
  facilityId: string;
  isStandaloneHolder: boolean;
}) {
  const { catalogQuery, viewMutation, downloadMutation } = useFacilityDocuments(facilityId);
  const documents = catalogQuery.data?.documents ?? [];

  const run = async (item: AdminDocumentCatalogItem, action: "view" | "download") => {
    try {
      const row = item as FacilityDocumentCatalogItem;
      if (action === "view") await viewMutation.mutateAsync(row);
      else await downloadMutation.mutateAsync(row);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Document is not available");
    }
  };

  return (
    <AdminDocumentCatalogPanel
      description={
        isStandaloneHolder
          ? "Legal documents for this customer."
          : "Legal documents for this facility."
      }
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
