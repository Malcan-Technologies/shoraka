/**
 * Shared Admin document-catalog row. Clients pass these ids, never storage keys.
 */

export type AdminDocumentCatalogItem = {
  id: string;
  title: string;
  description: string;
  available: boolean;
  unavailableHint: string | null;
  filename: string | null;
  generatedAt?: string | null;
};

export const ADMIN_DOCUMENT_DESCRIPTIONS = {
  underlyingContract: "Commercial contract uploaded with the facility application.",
  letterOfOffer:
    "Generated from the current Letter of Offer template and this offer's frozen terms.",
  facilityAgreement:
    "Digitally signed Facility Agreement from the completed signing package.",
  facilityAgreementPackage:
    "Compiled PDF of the signed Facility Agreement, current Letter of Offer, and any Tawarruq certificates. Not the digitally signed original.",
  jsg: "Signed guarantee from the completed signing package.",
  doa: "Signed deed assigning receivables from the completed signing package.",
  prospectus: "Approved prospectus frozen for this note.",
  investmentNoteCertificate: "Certificate issued for this Islamic Investment Note.",
  shorakaCertificate: "Original Tawarruq trade certificate from issuer disbursement.",
} as const;

export const ADMIN_DOCUMENT_UNAVAILABLE_HINTS = {
  waitingSigningPackage: "Waiting for the signing package to complete.",
  waitingOfferSent: "Waiting for the offer to be sent.",
  waitingProspectusApproval: "Waiting for prospectus approval.",
  waitingCertificateIssued: "Waiting for the certificate to be issued.",
  waitingTawarruqExecution: "Waiting for Tawarruq execution.",
  waitingUnderlyingContract: "Waiting for the commercial contract to be uploaded.",
  waitingFacilityAgreementSigned: "Waiting for the Facility Agreement to be signed.",
  letterOfOfferNotOnProduct: "This product version does not include a Letter of Offer.",
  compiledPackageNeedsLetterOfOffer: "The compiled package needs a current Letter of Offer.",
  signedNotStored: (label: string) => `The signed ${label} is not stored yet.`,
  prospectusPdfPending: "The approved Prospectus PDF is still being generated.",
  investmentCertificatePending:
    "The Islamic Investment Note Certificate is still being generated.",
  investmentCertificateFailed:
    "The Islamic Investment Note Certificate could not be generated.",
  shorakaNotUploaded: "The Shoraka / Tawarruq certificate has not been uploaded yet.",
} as const;
