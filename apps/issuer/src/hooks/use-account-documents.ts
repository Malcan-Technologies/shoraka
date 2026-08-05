import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import {
  filterSiteDocumentsSupersededByLegal,
  type AccountLegalDocumentResponse,
  type LegalAcceptanceAudience,
  type SiteDocumentResponse,
} from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type UnifiedAccountDocument =
  | {
      source: "SITE_DOCUMENT";
      id: string;
      title: string;
      fileName: string;
      fileSize: number;
      type: string;
    }
  | {
      source: "LEGAL_DOCUMENT";
      id: string;
      title: string;
      fileName: string;
      fileSize: number;
      legalDocumentVersionId: string;
      type: string;
    };

/**
 * LegalDocument takes priority over SiteDocument for the same user-facing class.
 * Mapping is by stable SiteDocumentType → LegalDocumentType keys, not title/filename.
 */
export function mergeAccountDocuments(
  siteDocs: SiteDocumentResponse[],
  legalDocs: AccountLegalDocumentResponse[]
): UnifiedAccountDocument[] {
  const legal: UnifiedAccountDocument[] = legalDocs.map((doc) => ({
    source: "LEGAL_DOCUMENT" as const,
    id: doc.legalDocumentVersionId,
    title: doc.title,
    fileName: doc.file_name,
    fileSize: doc.file_size,
    legalDocumentVersionId: doc.legalDocumentVersionId,
    type: doc.type,
  }));

  const visibleSiteDocs = filterSiteDocumentsSupersededByLegal(
    siteDocs,
    legalDocs.map((doc) => doc.type)
  );

  const site: UnifiedAccountDocument[] = visibleSiteDocs.map((doc) => ({
    source: "SITE_DOCUMENT" as const,
    id: doc.id,
    title: doc.title,
    fileName: doc.file_name,
    fileSize: doc.file_size,
    type: doc.type,
  }));

  return [...legal, ...site];
}

export function useAccountDocuments(audience: LegalAcceptanceAudience) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["account-documents", audience],
    queryFn: async () => {
      const [siteResult, legalResult] = await Promise.all([
        apiClient.getAccountDocuments(),
        apiClient.getAccountLegalDocuments(audience),
      ]);
      if (!siteResult.success) {
        throw new Error(siteResult.error.message);
      }
      if (!legalResult.success) {
        throw new Error(legalResult.error.message);
      }
      return mergeAccountDocuments(
        siteResult.data.documents,
        legalResult.data.documents
      );
    },
    staleTime: 1000 * 60 * 5,
  });
}

export type { SiteDocumentResponse, AccountLegalDocumentResponse };
