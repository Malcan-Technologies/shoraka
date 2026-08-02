import type { LegalDocumentType, PublicLegalDocumentResponse } from "@cashsouk/types";

export type CompactPortalLegalLink = {
  label: string;
  /** Path under the landing origin, e.g. `/legal` or `/legal/terms-of-use`. */
  path: string;
  permanent?: boolean;
};

/** Individual compact links — only shown when a matching published public doc exists. */
export const CONDITIONAL_COMPACT_LEGAL_LINKS: ReadonlyArray<{
  type: LegalDocumentType;
  label: string;
}> = [
  { type: "TERMS_OF_USE", label: "Terms of Use" },
  { type: "PDPA_NOTICE_AND_CONSENT", label: "PDPA" },
  { type: "RISK_STATEMENT", label: "Risk Statement" },
];

/**
 * Build compact portal legal links from the public legal-document list.
 * Always includes Legal Documents. Individual links use API-provided slugs only.
 */
export function buildCompactPortalLegalLinks(
  documents: PublicLegalDocumentResponse[]
): CompactPortalLegalLink[] {
  const byType = new Map<LegalDocumentType, PublicLegalDocumentResponse>();
  for (const doc of documents) {
    if (!byType.has(doc.type)) {
      byType.set(doc.type, doc);
    }
  }

  const links: CompactPortalLegalLink[] = [
    { label: "Legal Documents", path: "/legal", permanent: true },
  ];

  for (const item of CONDITIONAL_COMPACT_LEGAL_LINKS) {
    const doc = byType.get(item.type);
    if (!doc?.slug) continue;
    links.push({
      label: item.label,
      path: `/legal/${doc.slug}`,
    });
  }

  return links;
}

/** Loading / error-safe default: only the permanent Legal Documents link. */
export function permanentCompactPortalLegalLinks(): CompactPortalLegalLink[] {
  return [{ label: "Legal Documents", path: "/legal", permanent: true }];
}
