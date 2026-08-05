import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { AccountLegalDocumentResponse, LegalAcceptanceAudience } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type UnifiedAccountDocument = {
  source: "LEGAL_DOCUMENT";
  id: string;
  title: string;
  fileName: string;
  fileSize: number;
  legalDocumentVersionId: string;
  type: string;
};

export function useAccountDocuments(audience: LegalAcceptanceAudience) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  return useQuery({
    queryKey: ["account-documents", audience],
    queryFn: async () => {
      const legalResult = await apiClient.getAccountLegalDocuments(audience);
      if (!legalResult.success) throw new Error(legalResult.error.message);
      return legalResult.data.documents.map((doc): UnifiedAccountDocument => ({
        source: "LEGAL_DOCUMENT",
        id: doc.legalDocumentVersionId,
        title: doc.title,
        fileName: doc.file_name,
        fileSize: doc.file_size,
        legalDocumentVersionId: doc.legalDocumentVersionId,
        type: doc.type,
      }));
    },
    staleTime: 1000 * 60 * 5,
  });
}

export type { AccountLegalDocumentResponse };
