import {
  LEGAL_DOCUMENT_TYPE_LABELS,
  LEGAL_DOCUMENT_TYPES,
  type LegalDocumentType,
} from "@cashsouk/types";

/** Match visible type labels (e.g. "Terms of Use") plus the raw enum. */
export function matchingLegalDocumentTypes(search: string): LegalDocumentType[] {
  const query = search.trim().toLowerCase();
  if (!query) return [];

  return LEGAL_DOCUMENT_TYPES.filter((type) => {
    const label = LEGAL_DOCUMENT_TYPE_LABELS[type].toLowerCase();
    const enumAsWords = type.replaceAll("_", " ").toLowerCase();
    return label.includes(query) || enumAsWords.includes(query) || type.toLowerCase().includes(query);
  });
}
