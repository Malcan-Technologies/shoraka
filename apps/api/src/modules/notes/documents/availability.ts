import {
  ADMIN_DOCUMENT_DESCRIPTIONS,
  ADMIN_DOCUMENT_UNAVAILABLE_HINTS,
  type AdminDocumentCatalogItem,
} from "@cashsouk/types";
import {
  signedDocumentIsAvailable,
  type NoteSigningDocumentLike,
  type NoteSigningEnvelopeLike,
} from "./envelope";
import {
  shorakaCertificateIsAvailable,
  type ShorakaCertificateOrderInput,
} from "./certificate-order";

export type Availability = Pick<
  AdminDocumentCatalogItem,
  "available" | "description" | "unavailableHint"
>;

function result(
  available: boolean,
  description: string,
  unavailableHint: string | null
): Availability {
  return { available, description, unavailableHint };
}

export function signingDocumentAvailability(input: {
  envelope: NoteSigningEnvelopeLike | null;
  document: NoteSigningDocumentLike | null;
  description: string;
  includedLabel: string;
  missingFromPackageMessage: string;
}): Availability {
  const { description } = input;
  if (!input.envelope) {
    return result(false, description, ADMIN_DOCUMENT_UNAVAILABLE_HINTS.waitingSigningPackage);
  }
  if (!input.document) {
    return result(false, description, input.missingFromPackageMessage);
  }
  if (!signedDocumentIsAvailable(input.document)) {
    return result(
      false,
      description,
      ADMIN_DOCUMENT_UNAVAILABLE_HINTS.signedNotStored(input.includedLabel)
    );
  }
  return result(true, description, null);
}

export function letterOfOfferAvailability(input: {
  hasContract: boolean;
  offerSent: boolean;
  declaredOnProduct: boolean;
}): Availability {
  const description = ADMIN_DOCUMENT_DESCRIPTIONS.letterOfOffer;
  if (!input.hasContract || !input.offerSent) {
    return result(false, description, ADMIN_DOCUMENT_UNAVAILABLE_HINTS.waitingOfferSent);
  }
  if (!input.declaredOnProduct) {
    return result(false, description, ADMIN_DOCUMENT_UNAVAILABLE_HINTS.letterOfOfferNotOnProduct);
  }
  return result(true, description, null);
}

export function facilityAgreementPackageAvailability(input: {
  signedFaAvailable: boolean;
  letterOfOfferAvailable: boolean;
}): Availability {
  const description = ADMIN_DOCUMENT_DESCRIPTIONS.facilityAgreementPackage;
  if (!input.signedFaAvailable) {
    return result(
      false,
      description,
      ADMIN_DOCUMENT_UNAVAILABLE_HINTS.waitingFacilityAgreementSigned
    );
  }
  if (!input.letterOfOfferAvailable) {
    return result(
      false,
      description,
      ADMIN_DOCUMENT_UNAVAILABLE_HINTS.compiledPackageNeedsLetterOfOffer
    );
  }
  return result(true, description, null);
}

export function prospectusAvailability(input: {
  approved: boolean;
  pdfReady: boolean;
}): Availability {
  const description = ADMIN_DOCUMENT_DESCRIPTIONS.prospectus;
  if (!input.approved) {
    return result(false, description, ADMIN_DOCUMENT_UNAVAILABLE_HINTS.waitingProspectusApproval);
  }
  if (!input.pdfReady) {
    return result(false, description, ADMIN_DOCUMENT_UNAVAILABLE_HINTS.prospectusPdfPending);
  }
  return result(true, description, null);
}

export function investmentNoteCertificateAvailability(input: {
  issuedReady: boolean;
  pending: boolean;
  failed: boolean;
}): Availability {
  const description = ADMIN_DOCUMENT_DESCRIPTIONS.investmentNoteCertificate;
  if (input.issuedReady) {
    return result(true, description, null);
  }
  if (input.pending) {
    return result(false, description, ADMIN_DOCUMENT_UNAVAILABLE_HINTS.investmentCertificatePending);
  }
  if (input.failed) {
    return result(false, description, ADMIN_DOCUMENT_UNAVAILABLE_HINTS.investmentCertificateFailed);
  }
  return result(false, description, ADMIN_DOCUMENT_UNAVAILABLE_HINTS.waitingCertificateIssued);
}

export function shorakaGroupAvailability(
  rows: readonly ShorakaCertificateOrderInput[]
): Availability {
  const description = ADMIN_DOCUMENT_DESCRIPTIONS.shorakaCertificate;
  if (rows.length === 0) {
    return result(false, description, ADMIN_DOCUMENT_UNAVAILABLE_HINTS.waitingTawarruqExecution);
  }
  return result(false, description, ADMIN_DOCUMENT_UNAVAILABLE_HINTS.shorakaNotUploaded);
}

export function shorakaCertificateRowAvailability(
  row: ShorakaCertificateOrderInput
): Availability {
  const description = ADMIN_DOCUMENT_DESCRIPTIONS.shorakaCertificate;
  if (shorakaCertificateIsAvailable(row)) {
    return result(true, description, null);
  }
  return result(false, description, ADMIN_DOCUMENT_UNAVAILABLE_HINTS.shorakaNotUploaded);
}

export function underlyingContractAvailability(hasUpload: boolean): Availability {
  const description = ADMIN_DOCUMENT_DESCRIPTIONS.underlyingContract;
  if (!hasUpload) {
    return result(false, description, ADMIN_DOCUMENT_UNAVAILABLE_HINTS.waitingUnderlyingContract);
  }
  return result(true, description, null);
}
