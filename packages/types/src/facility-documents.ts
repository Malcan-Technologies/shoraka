/**
 * Admin facility-detail document catalog. Clients pass these ids, never storage keys.
 */

import type { AdminDocumentCatalogItem } from "./admin-document-catalog";

export const FACILITY_DOCUMENT_GROUPS = [
  "underlying-contract",
  "letter-of-offer",
  "facility-agreement",
  "jsg",
  "deed-of-assignment",
] as const;

export type FacilityDocumentGroup = (typeof FACILITY_DOCUMENT_GROUPS)[number];

export const FACILITY_DOCUMENT_FIXED_IDS = {
  underlyingContract: "underlying-contract",
  letterOfOffer: "letter-of-offer",
  facilityAgreement: "facility-agreement",
  jsg: "jsg",
  deedOfAssignment: "doa",
} as const;

export type FacilityDocumentFixedId =
  (typeof FACILITY_DOCUMENT_FIXED_IDS)[keyof typeof FACILITY_DOCUMENT_FIXED_IDS];

export function isFacilityDocumentFixedId(value: string): value is FacilityDocumentFixedId {
  return (Object.values(FACILITY_DOCUMENT_FIXED_IDS) as string[]).includes(value);
}

export type FacilityDocumentCatalogItem = AdminDocumentCatalogItem & {
  group: FacilityDocumentGroup;
};

export type FacilityDocumentCatalog = {
  facilityId: string;
  facilityReference: string;
  documents: FacilityDocumentCatalogItem[];
};

export type FacilityDocumentContentDisposition = "inline" | "attachment";
