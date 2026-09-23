"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { FacilityDocumentCatalogItem } from "@cashsouk/types";
import {
  downloadAdminDocumentBlob,
  openAdminDocumentBlobInNewTab,
} from "@/components/admin-detail/admin-document-blob";
import { contractsKeys } from "@/contracts/query-keys";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useFacilityDocuments(facilityId?: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  const catalogQuery = useQuery({
    queryKey: facilityId
      ? contractsKeys.documents(facilityId)
      : [...contractsKeys.all, "documents", "pending"],
    enabled: Boolean(facilityId),
    queryFn: async () => {
      if (!facilityId) throw new Error("Facility ID is required");
      const response = await apiClient.getAdminFacilityDocuments(facilityId);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
  });

  const viewMutation = useMutation({
    mutationFn: async (item: FacilityDocumentCatalogItem) => {
      if (!facilityId) throw new Error("Facility ID is required");
      await openAdminDocumentBlobInNewTab(
        () => apiClient.getAdminFacilityDocumentBlob(facilityId, item.id, "inline"),
        "Pop-up blocked. Allow pop-ups for this site to view the PDF."
      );
    },
  });

  const downloadMutation = useMutation({
    mutationFn: async (item: FacilityDocumentCatalogItem) => {
      if (!facilityId) throw new Error("Facility ID is required");
      const { blob, filename } = await apiClient.getAdminFacilityDocumentBlob(
        facilityId,
        item.id,
        "attachment"
      );
      downloadAdminDocumentBlob(blob, item.filename || filename);
    },
  });

  return { catalogQuery, viewMutation, downloadMutation };
}
