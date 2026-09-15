/**
 * Admin note-detail document catalog. Clients pass these ids, never storage keys.
 */

export const NOTE_DOCUMENT_GROUPS = [
  "jsg",
  "letter-of-offer",
  "facility-agreement-package",
  "deed-of-assignment",
  "prospectus",
  "investment-note-certificate",
  "shoraka-certificate",
] as const;

export type NoteDocumentGroup = (typeof NOTE_DOCUMENT_GROUPS)[number];

export const NOTE_DOCUMENT_ORIGINS = ["canonical", "compiled", "generated"] as const;

export type NoteDocumentOrigin = (typeof NOTE_DOCUMENT_ORIGINS)[number];

export const NOTE_DOCUMENT_FIXED_IDS = {
  jsg: "jsg",
  letterOfOffer: "letter-of-offer",
  facilityAgreementPackage: "facility-agreement-package",
  deedOfAssignment: "doa",
  prospectus: "prospectus",
  investmentNoteCertificate: "investment-note-certificate",
  shorakaCertificatePlaceholder: "shoraka-certificate",
} as const;

export type NoteDocumentFixedId =
  (typeof NOTE_DOCUMENT_FIXED_IDS)[keyof typeof NOTE_DOCUMENT_FIXED_IDS];

const SHORAKA_CERTIFICATE_PREFIX = "shoraka-certificate-";

export function shorakaCertificateDocumentId(tradeOrderId: string): string {
  return `${SHORAKA_CERTIFICATE_PREFIX}${tradeOrderId}`;
}

export function parseShorakaCertificateDocumentId(documentId: string): string | null {
  if (documentId === NOTE_DOCUMENT_FIXED_IDS.shorakaCertificatePlaceholder) return null;
  if (!documentId.startsWith(SHORAKA_CERTIFICATE_PREFIX)) return null;
  const tradeOrderId = documentId.slice(SHORAKA_CERTIFICATE_PREFIX.length).trim();
  return tradeOrderId.length > 0 ? tradeOrderId : null;
}

export function isNoteDocumentFixedId(value: string): value is NoteDocumentFixedId {
  return (Object.values(NOTE_DOCUMENT_FIXED_IDS) as string[]).includes(value);
}

export type NoteDocumentCatalogItem = {
  id: string;
  group: NoteDocumentGroup;
  title: string;
  origin: NoteDocumentOrigin;
  originLabel: string;
  available: boolean;
  availabilityReason: string;
  filename: string | null;
  certificateCount?: number;
  generatedAt?: string | null;
};

export type NoteDocumentCatalog = {
  noteId: string;
  noteReference: string;
  documents: NoteDocumentCatalogItem[];
};

export type NoteDocumentContentDisposition = "inline" | "attachment";
