import type { NoteDocumentCatalogItem, NoteDocumentOrigin } from "@cashsouk/types";
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
  NoteDocumentCatalogItem,
  "available" | "availabilityReason" | "origin" | "originLabel"
>;

function result(
  available: boolean,
  origin: NoteDocumentOrigin,
  originLabel: string,
  availabilityReason: string
): Availability {
  return { available, origin, originLabel, availabilityReason };
}

export function signingDocumentAvailability(input: {
  envelope: NoteSigningEnvelopeLike | null;
  document: NoteSigningDocumentLike | null;
  includedLabel: string;
  missingFromPackageMessage: string;
}): Availability {
  if (!input.envelope) {
    return result(
      false,
      "canonical",
      "Canonical",
      "Available after the signing package for this note's offer is completed."
    );
  }
  if (!input.document) {
    return result(false, "canonical", "Canonical", input.missingFromPackageMessage);
  }
  if (!signedDocumentIsAvailable(input.document)) {
    return result(
      false,
      "canonical",
      "Canonical",
      `The signed ${input.includedLabel} is not stored yet.`
    );
  }
  return result(
    true,
    "canonical",
    "Canonical",
    `Signed original from the completed signing package.`
  );
}

export function letterOfOfferAvailability(input: {
  hasContract: boolean;
  offerSent: boolean;
  declaredOnProduct: boolean;
}): Availability {
  if (!input.hasContract || !input.offerSent) {
    return result(
      false,
      "generated",
      "Generated now",
      "The Letter of Offer can be generated after the facility offer is sent."
    );
  }
  if (!input.declaredOnProduct) {
    return result(
      false,
      "generated",
      "Generated now",
      "This product version does not include a Letter of Offer."
    );
  }
  return result(
    true,
    "generated",
    "Generated now",
    "Generated now from the current Letter of Offer template and frozen offer data."
  );
}

export function facilityAgreementPackageAvailability(input: {
  signedFaAvailable: boolean;
  letterOfOfferAvailable: boolean;
  certificateCount: number;
}): Availability {
  if (!input.signedFaAvailable) {
    return result(
      false,
      "compiled",
      "Compiled copy",
      "Available after the Facility Agreement is signed."
    );
  }
  if (!input.letterOfOfferAvailable) {
    return result(
      false,
      "compiled",
      "Compiled copy",
      "The compiled package needs a current Letter of Offer."
    );
  }
  const certNote =
    input.certificateCount === 0
      ? "No Shoraka certificates are attached yet."
      : input.certificateCount === 1
        ? "Includes 1 Shoraka certificate."
        : `Includes ${input.certificateCount} Shoraka certificates.`;
  return result(
    true,
    "compiled",
    "Compiled copy",
    `Compiled copy of the signed Facility Agreement with the current Letter of Offer. Not the digitally signed original. ${certNote}`
  );
}

export function prospectusAvailability(input: {
  approved: boolean;
  pdfReady: boolean;
}): Availability {
  if (!input.approved) {
    return result(false, "canonical", "Canonical", "Available after the Prospectus is approved.");
  }
  if (!input.pdfReady) {
    return result(
      false,
      "canonical",
      "Canonical",
      "The approved Prospectus PDF is still being generated."
    );
  }
  return result(true, "canonical", "Canonical", "Approved frozen Prospectus.");
}

export function investmentNoteCertificateAvailability(input: {
  issuedReady: boolean;
  pending: boolean;
  failed: boolean;
}): Availability {
  if (input.issuedReady) {
    return result(
      true,
      "canonical",
      "Canonical",
      "Issued Islamic Investment Note Certificate for this note."
    );
  }
  if (input.pending) {
    return result(
      false,
      "canonical",
      "Canonical",
      "The Islamic Investment Note Certificate is still being generated."
    );
  }
  if (input.failed) {
    return result(
      false,
      "canonical",
      "Canonical",
      "The Islamic Investment Note Certificate could not be generated."
    );
  }
  return result(
    false,
    "canonical",
    "Canonical",
    "Available after the Islamic Investment Note Certificate is issued."
  );
}

export function shorakaGroupAvailability(rows: readonly ShorakaCertificateOrderInput[]): Availability {
  if (rows.length === 0) {
    return result(
      false,
      "canonical",
      "Canonical",
      "Available after Tawarruq execution. Only issuer-disbursement Shoraka certificates exist today."
    );
  }
  return result(false, "canonical", "Canonical", "The Shoraka / Tawarruq certificate has not been uploaded yet.");
}

export function shorakaCertificateRowAvailability(
  row: ShorakaCertificateOrderInput
): Availability {
  if (shorakaCertificateIsAvailable(row)) {
    return result(true, "canonical", "Canonical", "Original Shoraka / Tawarruq certificate.");
  }
  return result(
    false,
    "canonical",
    "Canonical",
    "The Shoraka / Tawarruq certificate has not been uploaded yet."
  );
}
