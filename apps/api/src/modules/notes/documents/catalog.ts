import {
  NOTE_DOCUMENT_FIXED_IDS,
  shorakaCertificateDocumentId,
  type NoteDocumentCatalog,
  type NoteDocumentCatalogItem,
} from "@cashsouk/types";
import { prospectusPdfFileName } from "../prospectus/prospectus-pdf";
import {
  facilityAgreementPackageAvailability,
  investmentNoteCertificateAvailability,
  letterOfOfferAvailability,
  prospectusAvailability,
  shorakaCertificateRowAvailability,
  shorakaGroupAvailability,
  signingDocumentAvailability,
  type Availability,
} from "./availability";
import {
  shorakaCertificateIsAvailable,
  type ShorakaCertificateOrderInput,
} from "./certificate-order";
import {
  type NoteSigningDocumentLike,
  type NoteSigningEnvelopeLike,
} from "./envelope";
import {
  facilityAgreementPackageFilename,
  safeNoteDocumentFilename,
  shorakaCertificateFilename,
} from "./filenames";

export type NoteDocumentCatalogSnapshot = {
  noteId: string;
  noteReference: string;
  envelope: NoteSigningEnvelopeLike | null;
  jsg: NoteSigningDocumentLike | null;
  facilityAgreement: NoteSigningDocumentLike | null;
  doa: NoteSigningDocumentLike | null;
  letterOfOffer: {
    hasContract: boolean;
    offerSent: boolean;
    declaredOnProduct: boolean;
  };
  prospectus: { approved: boolean; pdfReady: boolean };
  investmentCertificate: {
    issuedReady: boolean;
    pending: boolean;
    failed: boolean;
    filename: string | null;
  };
  shoraka: ShorakaCertificateOrderInput[];
  faPackageGeneratedAt: string | null;
};

function row(
  partial: Omit<NoteDocumentCatalogItem, keyof Availability> & Availability
): NoteDocumentCatalogItem {
  return partial;
}

export function buildNoteDocumentCatalog(
  snapshot: NoteDocumentCatalogSnapshot
): NoteDocumentCatalog {
  const ref = snapshot.noteReference;
  const jsg = signingDocumentAvailability({
    envelope: snapshot.envelope,
    document: snapshot.jsg,
    includedLabel: "Joint and Several Guarantee",
    missingFromPackageMessage:
      "This note's completed signing package does not include a Joint and Several Guarantee.",
  });
  const lo = letterOfOfferAvailability(snapshot.letterOfOffer);
  const signedFa = signingDocumentAvailability({
    envelope: snapshot.envelope,
    document: snapshot.facilityAgreement,
    includedLabel: "Facility Agreement",
    missingFromPackageMessage:
      "This note's completed signing package does not include a Facility Agreement.",
  });
  const certificateCount = snapshot.shoraka.filter(shorakaCertificateIsAvailable).length;
  const faPackage = facilityAgreementPackageAvailability({
    signedFaAvailable: signedFa.available,
    letterOfOfferAvailable: lo.available,
    certificateCount,
  });
  const doa = signingDocumentAvailability({
    envelope: snapshot.envelope,
    document: snapshot.doa,
    includedLabel: "Deed of Assignment",
    missingFromPackageMessage:
      "This note's completed signing package does not include a Deed of Assignment.",
  });
  const prospectus = prospectusAvailability(snapshot.prospectus);
  const investment = investmentNoteCertificateAvailability(snapshot.investmentCertificate);

  const documents: NoteDocumentCatalogItem[] = [
    row({
      id: NOTE_DOCUMENT_FIXED_IDS.jsg,
      group: "jsg",
      title: "Joint and Several Guarantee",
      filename: jsg.available ? safeNoteDocumentFilename(ref, "JSG") : null,
      ...jsg,
    }),
    row({
      id: NOTE_DOCUMENT_FIXED_IDS.letterOfOffer,
      group: "letter-of-offer",
      title: "Letter of Offer",
      filename: lo.available ? safeNoteDocumentFilename(ref, "LO") : null,
      ...lo,
    }),
    row({
      id: NOTE_DOCUMENT_FIXED_IDS.facilityAgreementPackage,
      group: "facility-agreement-package",
      title: "Facility Agreement Package",
      filename: faPackage.available ? facilityAgreementPackageFilename(ref) : null,
      certificateCount,
      generatedAt: snapshot.faPackageGeneratedAt,
      ...faPackage,
    }),
    row({
      id: NOTE_DOCUMENT_FIXED_IDS.deedOfAssignment,
      group: "deed-of-assignment",
      title: "Deed of Assignment",
      filename: doa.available ? safeNoteDocumentFilename(ref, "DOA") : null,
      ...doa,
    }),
    row({
      id: NOTE_DOCUMENT_FIXED_IDS.prospectus,
      group: "prospectus",
      title: "Prospectus",
      filename: prospectus.available ? prospectusPdfFileName(ref) : null,
      ...prospectus,
    }),
    row({
      id: NOTE_DOCUMENT_FIXED_IDS.investmentNoteCertificate,
      group: "investment-note-certificate",
      title: "Islamic Investment Note Certificate",
      filename: investment.available ? snapshot.investmentCertificate.filename : null,
      ...investment,
    }),
    ...buildShorakaCatalogItems(snapshot),
  ];

  return {
    noteId: snapshot.noteId,
    noteReference: snapshot.noteReference,
    documents,
  };
}

function buildShorakaCatalogItems(
  snapshot: NoteDocumentCatalogSnapshot
): NoteDocumentCatalogItem[] {
  if (snapshot.shoraka.length === 0) {
    return [
      row({
        id: NOTE_DOCUMENT_FIXED_IDS.shorakaCertificatePlaceholder,
        group: "shoraka-certificate",
        title: "Shoraka / Tawarruq certificates",
        filename: null,
        certificateCount: 0,
        ...shorakaGroupAvailability(snapshot.shoraka),
      }),
    ];
  }

  const multiple = snapshot.shoraka.length > 1;
  return snapshot.shoraka.map((entry, index) => {
    const availability = shorakaCertificateRowAvailability(entry);
    return row({
      id: shorakaCertificateDocumentId(entry.id),
      group: "shoraka-certificate",
      title: multiple
        ? `Shoraka / Tawarruq certificate ${index + 1}`
        : "Shoraka / Tawarruq certificate",
      filename: availability.available
        ? shorakaCertificateFilename(snapshot.noteReference, entry.id)
        : null,
      certificateCount: 1,
      ...availability,
    });
  });
}
