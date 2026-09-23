import {
  ADMIN_DOCUMENT_DESCRIPTIONS,
  FACILITY_DOCUMENT_FIXED_IDS,
  type FacilityDocumentCatalog,
  type FacilityDocumentCatalogItem,
} from "@cashsouk/types";
import {
  letterOfOfferAvailability,
  signingDocumentAvailability,
  underlyingContractAvailability,
  type Availability,
} from "../../notes/documents/availability";
import type {
  NoteSigningDocumentLike,
  NoteSigningEnvelopeLike,
} from "../../notes/documents/envelope";
import { safeFacilityDocumentFilename } from "./filenames";

export type FacilityUnderlyingContract = {
  s3Key: string;
  fileName: string;
};

export type FacilityDocumentCatalogSnapshot = {
  facilityId: string;
  facilityReference: string;
  underlyingContract: FacilityUnderlyingContract | null;
  envelope: NoteSigningEnvelopeLike | null;
  jsg: NoteSigningDocumentLike | null;
  facilityAgreement: NoteSigningDocumentLike | null;
  doa: NoteSigningDocumentLike | null;
  letterOfOffer: {
    hasContract: boolean;
    offerSent: boolean;
    declaredOnProduct: boolean;
  };
};

function row(
  partial: Omit<FacilityDocumentCatalogItem, keyof Availability> & Availability
): FacilityDocumentCatalogItem {
  return partial;
}

export function buildFacilityDocumentCatalog(
  snapshot: FacilityDocumentCatalogSnapshot
): FacilityDocumentCatalog {
  const ref = snapshot.facilityReference;
  const underlying = underlyingContractAvailability(Boolean(snapshot.underlyingContract));
  const lo = letterOfOfferAvailability(snapshot.letterOfOffer);
  const fa = signingDocumentAvailability({
    envelope: snapshot.envelope,
    document: snapshot.facilityAgreement,
    description: ADMIN_DOCUMENT_DESCRIPTIONS.facilityAgreement,
    includedLabel: "Facility Agreement",
    missingFromPackageMessage:
      "This facility's completed signing package does not include a Facility Agreement.",
  });
  const jsg = signingDocumentAvailability({
    envelope: snapshot.envelope,
    document: snapshot.jsg,
    description: ADMIN_DOCUMENT_DESCRIPTIONS.jsg,
    includedLabel: "Joint and Several Guarantee",
    missingFromPackageMessage:
      "This facility's completed signing package does not include a Joint and Several Guarantee.",
  });
  const doa = signingDocumentAvailability({
    envelope: snapshot.envelope,
    document: snapshot.doa,
    description: ADMIN_DOCUMENT_DESCRIPTIONS.doa,
    includedLabel: "Deed of Assignment",
    missingFromPackageMessage:
      "This facility's completed signing package does not include a Deed of Assignment.",
  });

  const documents: FacilityDocumentCatalogItem[] = [
    row({
      id: FACILITY_DOCUMENT_FIXED_IDS.underlyingContract,
      group: "underlying-contract",
      title: "Underlying contract",
      filename: underlying.available ? snapshot.underlyingContract?.fileName ?? null : null,
      ...underlying,
    }),
    row({
      id: FACILITY_DOCUMENT_FIXED_IDS.letterOfOffer,
      group: "letter-of-offer",
      title: "Letter of Offer",
      filename: lo.available ? safeFacilityDocumentFilename(ref, "LO") : null,
      ...lo,
    }),
    row({
      id: FACILITY_DOCUMENT_FIXED_IDS.facilityAgreement,
      group: "facility-agreement",
      title: "Facility Agreement",
      filename: fa.available ? safeFacilityDocumentFilename(ref, "FA") : null,
      ...fa,
    }),
    row({
      id: FACILITY_DOCUMENT_FIXED_IDS.jsg,
      group: "jsg",
      title: "Joint and Several Guarantee",
      filename: jsg.available ? safeFacilityDocumentFilename(ref, "JSG") : null,
      ...jsg,
    }),
    row({
      id: FACILITY_DOCUMENT_FIXED_IDS.deedOfAssignment,
      group: "deed-of-assignment",
      title: "Deed of Assignment",
      filename: doa.available ? safeFacilityDocumentFilename(ref, "DOA") : null,
      ...doa,
    }),
  ];

  return {
    facilityId: snapshot.facilityId,
    facilityReference: snapshot.facilityReference,
    documents,
  };
}
