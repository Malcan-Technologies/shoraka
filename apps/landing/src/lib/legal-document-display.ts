import {
  LEGAL_DOCUMENT_TYPE_LABELS,
  type LegalDocumentType,
  type PublicLegalDocumentResponse,
} from "@cashsouk/types";

const PLACEHOLDER_TITLES = new Set(["t", "test", "asdf", "xxx", "todo", "temp", "tmp"]);
const PLACEHOLDER_DESCRIPTIONS = new Set(["a", "b", "test", "asdf", "xxx", "todo", "temp", "tmp", "n/a", "na"]);

/** Minimum length for a public-facing description. */
export const MIN_PUBLIC_DESCRIPTION_LENGTH = 24;

export function resolvePublicLegalTitle(
  document: Pick<PublicLegalDocumentResponse, "title" | "type">
): string {
  const typeLabel = LEGAL_DOCUMENT_TYPE_LABELS[document.type as LegalDocumentType] || document.type;
  const title = document.title?.trim() ?? "";
  if (!title) return typeLabel;
  if (title.length < 3) return typeLabel;
  if (PLACEHOLDER_TITLES.has(title.toLowerCase())) return typeLabel;
  return title;
}

/**
 * Returns a public description only when it looks meaningful.
 * Does not invent legal copy.
 */
export function resolvePublicLegalDescription(description: string | null | undefined): string | null {
  if (!description) return null;
  const trimmed = description.trim();
  if (!trimmed) return null;
  if (trimmed.length < MIN_PUBLIC_DESCRIPTION_LENGTH) return null;
  if (PLACEHOLDER_DESCRIPTIONS.has(trimmed.toLowerCase())) return null;
  return trimmed;
}

/** Public-friendly date, e.g. `3 August 2026`. */
export function formatPublicLegalPublishedDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function buildPublicLegalMetadataLine(input: {
  version: number;
  publishedAt: string | null | undefined;
}): string {
  const parts = [`Version ${input.version}`];
  const published = formatPublicLegalPublishedDate(input.publishedAt);
  if (published) parts.push(`Published ${published}`);
  return parts.join(" · ");
}

export function publicLegalViewPath(versionId: string, apiUrl: string): string {
  return `${apiUrl.replace(/\/$/, "")}/v1/public/legal-documents/versions/${versionId}/view`;
}

export function publicLegalDownloadPath(versionId: string, apiUrl: string): string {
  return `${apiUrl.replace(/\/$/, "")}/v1/public/legal-documents/versions/${versionId}/download`;
}
