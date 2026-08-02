"use client";

import { useEffect, useState } from "react";
import type { PublicLegalDocumentResponse } from "@cashsouk/types";
import {
  buildCompactPortalLegalLinks,
  permanentCompactPortalLegalLinks,
  type CompactPortalLegalLink,
} from "../lib/compact-portal-legal-links";

type CacheEntry = {
  promise?: Promise<PublicLegalDocumentResponse[]>;
  data?: PublicLegalDocumentResponse[];
};

const cacheByApiUrl = new Map<string, CacheEntry>();

function apiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");
}

async function loadPublicLegalDocuments(apiUrl: string): Promise<PublicLegalDocumentResponse[]> {
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

/**
 * Shared public legal list for portal sidebar/footer links.
 * Does not toast on failure. While loading / on error, only permanent Legal Documents is returned.
 */
export function useCompactPortalLegalLinks(): {
  links: CompactPortalLegalLink[];
  loading: boolean;
} {
  const [links, setLinks] = useState<CompactPortalLegalLink[]>(() =>
    permanentCompactPortalLegalLinks()
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const apiUrl = apiBaseUrl();

    setLoading(true);
    void loadPublicLegalDocuments(apiUrl).then((documents) => {
      if (cancelled) return;
      setLinks(buildCompactPortalLegalLinks(documents));
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return { links, loading };
}
