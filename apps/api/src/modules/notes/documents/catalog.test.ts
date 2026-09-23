import { NOTE_DOCUMENT_FIXED_IDS } from "@cashsouk/types";
import { buildNoteDocumentCatalog, type NoteDocumentCatalogSnapshot } from "./catalog";

function snapshot(
  overrides: Partial<NoteDocumentCatalogSnapshot> = {}
): NoteDocumentCatalogSnapshot {
  return {
    noteId: "note-1",
    noteReference: "NOTE-001",
    envelope: null,
    jsg: null,
    facilityAgreement: null,
    doa: null,
    letterOfOffer: { hasContract: false, offerSent: false, declaredOnProduct: false },
    prospectus: { approved: false, pdfReady: false },
    investmentCertificate: {
      issuedReady: false,
      pending: false,
      failed: false,
      filename: null,
    },
    shoraka: [],
    faPackageGeneratedAt: null,
    ...overrides,
  };
}

describe("note document catalog", () => {
  it("keeps seven groups visible when nothing is available and never exposes storage keys", () => {
    const catalog = buildNoteDocumentCatalog(snapshot());
    expect(catalog.documents.map((row) => row.group)).toEqual([
      "jsg",
      "letter-of-offer",
      "facility-agreement-package",
      "deed-of-assignment",
      "prospectus",
      "investment-note-certificate",
      "shoraka-certificate",
    ]);
    expect(catalog.documents.every((row) => row.available === false)).toBe(true);
    expect(catalog.documents[0]?.id).toBe(NOTE_DOCUMENT_FIXED_IDS.jsg);
    expect(catalog.documents[0]?.description).toMatch(/Signed guarantee/);
    expect(catalog.documents[0]?.unavailableHint).toMatch(/Waiting for/);
    expect(JSON.stringify(catalog)).not.toMatch(/s3/i);
    expect(JSON.stringify(catalog)).not.toContain("signed_s3_key");
  });

  it("expands Shoraka trade orders into one row each in lifecycle order", () => {
    const catalog = buildNoteDocumentCatalog(
      snapshot({
        shoraka: [
          {
            id: "order-a",
            created_at: new Date("2026-09-01"),
            certificate_s3_key: "key-a",
            certificate_file_sha256: "h1",
            withdrawalInstruction: {
              withdrawal_type: "ISSUER_DISBURSEMENT",
              created_at: new Date("2026-09-01"),
            },
          },
          {
            id: "order-b",
            created_at: new Date("2026-09-02"),
            certificate_s3_key: null,
            certificate_file_sha256: null,
            withdrawalInstruction: {
              withdrawal_type: "ISSUER_RESIDUAL_RETURN",
              created_at: new Date("2026-09-02"),
            },
          },
        ],
      })
    );
    const shoraka = catalog.documents.filter((row) => row.group === "shoraka-certificate");
    expect(shoraka.map((row) => row.id)).toEqual([
      "shoraka-certificate-order-a",
      "shoraka-certificate-order-b",
    ]);
    expect(shoraka[0]?.available).toBe(true);
    expect(shoraka[1]?.available).toBe(false);
    expect(JSON.stringify(shoraka)).not.toContain("key-a");
  });
});
