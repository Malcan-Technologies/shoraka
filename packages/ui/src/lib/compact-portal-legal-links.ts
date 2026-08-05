import {
  LEGAL_DOCUMENT_TYPE_LABELS,
  PUBLIC_FOOTER_LEGAL_TYPES,
  type LegalAcceptanceAudience,
  type LegalDocumentAudience,
  type LegalDocumentType,
  type PublicLegalDocumentResponse,
} from "@cashsouk/types";

export type PublicLegalPdfLink = {
  type: LegalDocumentType;
  label: string;
  versionId: string;
  title: string;
};

/** Compact portal links — only when a matching published public doc exists. */
export const COMPACT_PORTAL_LEGAL_LINK_TYPES: ReadonlyArray<{
  type: LegalDocumentType;
  label: string;
}> = [
  { type: "TERMS_OF_USE", label: "Terms of Use" },
  { type: "PDPA_NOTICE_AND_CONSENT", label: "PDPA" },
  { type: "RISK_STATEMENT", label: "Risk Statement" },
];

/** @deprecated Use COMPACT_PORTAL_LEGAL_LINK_TYPES */
export const CONDITIONAL_COMPACT_LEGAL_LINKS = COMPACT_PORTAL_LEGAL_LINK_TYPES;

export type CompactPortalLegalLink = PublicLegalPdfLink;

function indexByType(documents: PublicLegalDocumentResponse[]) {
  const byType = new Map<LegalDocumentType, PublicLegalDocumentResponse>();
  for (const doc of documents) {
    if (!byType.has(doc.type)) {
      byType.set(doc.type, doc);
    }
  }
  return byType;
}

function audiencesForPortal(
  portal: LegalAcceptanceAudience
): LegalDocumentAudience[] {
  return portal === "ISSUER"
    ? ["PUBLIC", "ISSUER", "BOTH"]
    : ["PUBLIC", "INVESTOR", "BOTH"];
}

export function buildPublicLegalPdfLinks(
  documents: PublicLegalDocumentResponse[],
  types: ReadonlyArray<{ type: LegalDocumentType; label: string }>
): PublicLegalPdfLink[] {
  const byType = indexByType(documents);
  const links: PublicLegalPdfLink[] = [];

  for (const item of types) {
    const doc = byType.get(item.type);
    if (!doc?.legalDocumentVersionId) continue;
    links.push({
      type: item.type,
      label: item.label,
      versionId: doc.legalDocumentVersionId,
      title: doc.title || item.label,
    });
  }

  return links;
}

/**
 * Authenticated portal footer: published + public_visibility docs that apply
 * to the portal audience. Labels come from legal document type.
 */
export function buildPortalFooterLegalLinks(
  documents: PublicLegalDocumentResponse[],
  portal: LegalAcceptanceAudience
): PublicLegalPdfLink[] {
  const allowed = new Set(audiencesForPortal(portal));
  const filtered = documents.filter((doc) => allowed.has(doc.audience));
  return buildPublicLegalPdfLinks(
    filtered,
    PUBLIC_FOOTER_LEGAL_TYPES.map((type) => ({
      type,
      label: LEGAL_DOCUMENT_TYPE_LABELS[type],
    }))
  );
}

/** Compact issuer/investor links (Terms, PDPA, Risk Statement). */
export function buildCompactPortalLegalLinks(
  documents: PublicLegalDocumentResponse[]
): PublicLegalPdfLink[] {
  return buildPublicLegalPdfLinks(documents, COMPACT_PORTAL_LEGAL_LINK_TYPES);
}

/** Full landing-footer legal set. */
export function buildLandingFooterLegalLinks(
  documents: PublicLegalDocumentResponse[]
): PublicLegalPdfLink[] {
  return buildPublicLegalPdfLinks(
    documents,
    PUBLIC_FOOTER_LEGAL_TYPES.map((type) => ({
      type,
      label: LEGAL_DOCUMENT_TYPE_LABELS[type],
    }))
  );
}

/** Loading / error-safe default: no links (section can hide). */
export function permanentCompactPortalLegalLinks(): PublicLegalPdfLink[] {
  return [];
}

export function publicLegalViewApiPath(versionId: string, apiUrl: string): string {
  return `${apiUrl.replace(/\/$/, "")}/v1/public/legal-documents/versions/${versionId}/view`;
}

export function publicLegalDownloadApiPath(versionId: string, apiUrl: string): string {
  return `${apiUrl.replace(/\/$/, "")}/v1/public/legal-documents/versions/${versionId}/download`;
}

/**
 * Fetch a short-lived signed URL from the public legal API and open it.
 * Does not expose raw S3 keys in the UI href.
 */
export async function openPublicLegalPdf(
  versionId: string,
  mode: "view" | "download" = "view",
  apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
): Promise<void> {
  const path =
    mode === "view"
      ? publicLegalViewApiPath(versionId, apiUrl)
      : publicLegalDownloadApiPath(versionId, apiUrl);
  const res = await fetch(path);
  const json = (await res.json()) as {
    success?: boolean;
    data?: { viewUrl?: string; downloadUrl?: string };
    error?: { message?: string };
  };
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || "PDF unavailable");
  }
  const url = mode === "view" ? json.data?.viewUrl : json.data?.downloadUrl;
  if (!url) {
    throw new Error("PDF unavailable");
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
