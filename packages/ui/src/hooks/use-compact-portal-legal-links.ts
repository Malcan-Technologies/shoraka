"use client";

import { useEffect, useState } from "react";
import type { PublicLegalDocumentResponse } from "@cashsouk/types";
import {
  buildCompactPortalLegalLinks,
  buildLandingFooterLegalLinks,
  buildPortalFooterLegalLinks,
  type PublicLegalPdfLink,
} from "../lib/compact-portal-legal-links";
import type { LegalAcceptanceAudience } from "@cashsouk/types";

type CacheEntry = {
  promise?: Promise<PublicLegalDocumentResponse[]>;
  data?: PublicLegalDocumentResponse[];
};

const cacheByApiUrl = new Map<string, CacheEntry>();

function apiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");
}

export async function loadPublicLegalDocuments(
  apiUrl = apiBaseUrl()
): Promise<PublicLegalDocumentResponse[]> {
  const existing = cacheByApiUrl.get(apiUrl);
  if (existing?.data) return existing.data;
  if (existing?.promise) return existing.promise;

  const promise = (async () => {
    try {
      const res = await fetch(`${apiUrl}/v1/public/legal-documents`);
      const json = (await res.json()) as {
        success?: boolean;
        data?: { documents?: PublicLegalDocumentResponse[] };
      };
      if (!res.ok || !json.success) {
        return [];
      }
      const documents = json.data?.documents ?? [];
      cacheByApiUrl.set(apiUrl, { data: documents });
      return documents;
    } catch {
      cacheByApiUrl.delete(apiUrl);
      return [];
    }
  })();

  cacheByApiUrl.set(apiUrl, { promise });
  return promise;
}

/** Test helper: clear in-memory public legal list cache. */
export function clearPublicLegalDocumentsCache(): void {
  cacheByApiUrl.clear();
}

export function usePublicLegalDocuments(): {
  documents: PublicLegalDocumentResponse[];
  loading: boolean;
} {
  const [documents, setDocuments] = useState<PublicLegalDocumentResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void loadPublicLegalDocuments().then((docs) => {
      if (cancelled) return;
      setDocuments(docs);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { documents, loading };
}

/**
 * Shared public legal PDF links for portal sidebar/footer.
 * While loading / on error, returns no links (section can hide).
 * Pass portal audience so issuer/investor only see applicable docs.
 */
export function useCompactPortalLegalLinks(
  portal?: LegalAcceptanceAudience
): {
  links: PublicLegalPdfLink[];
  loading: boolean;
} {
  const { documents, loading } = usePublicLegalDocuments();
  return {
    links: portal
      ? buildPortalFooterLegalLinks(documents, portal)
      : buildCompactPortalLegalLinks(documents),
    loading,
  };
}

export function useLandingFooterLegalLinks(): {
  links: PublicLegalPdfLink[];
  loading: boolean;
} {
  const { documents, loading } = usePublicLegalDocuments();
  return {
    links: buildLandingFooterLegalLinks(documents),
    loading,
  };
}
