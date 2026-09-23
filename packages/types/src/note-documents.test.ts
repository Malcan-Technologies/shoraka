import {
  isNoteDocumentFixedId,
  NOTE_DOCUMENT_FIXED_IDS,
  parseShorakaCertificateDocumentId,
  shorakaCertificateDocumentId,
  type NoteDocumentCatalog,
} from "./note-documents";

describe("note document ids", () => {
  it("builds and parses Shoraka certificate ids without colliding with the placeholder", () => {
    expect(NOTE_DOCUMENT_FIXED_IDS.shorakaCertificatePlaceholder).toBe("shoraka-certificate");
    expect(parseShorakaCertificateDocumentId("shoraka-certificate")).toBeNull();
    expect(shorakaCertificateDocumentId("order_1")).toBe("shoraka-certificate-order_1");
    expect(parseShorakaCertificateDocumentId("shoraka-certificate-order_1")).toBe("order_1");
  });

  it("rejects empty or unrelated ids", () => {
    expect(parseShorakaCertificateDocumentId("shoraka-certificate-")).toBeNull();
    expect(parseShorakaCertificateDocumentId("jsg")).toBeNull();
    expect(isNoteDocumentFixedId("jsg")).toBe(true);
    expect(isNoteDocumentFixedId("facility-agreement-package")).toBe(true);
    expect(isNoteDocumentFixedId("shoraka-certificate-order_1")).toBe(false);
  });

  it("keeps catalog DTOs free of storage keys", () => {
    const catalog: NoteDocumentCatalog = {
      noteId: "note-1",
      noteReference: "NOTE-001",
      documents: [
        {
          id: "jsg",
          group: "jsg",
          title: "Joint and Several Guarantee",
          description: "Signed guarantee from the completed signing package.",
          available: true,
          unavailableHint: null,
          filename: "JSG-NOTE-001.pdf",
        },
      ],
    };
    expect(JSON.stringify(catalog)).not.toMatch(/s3/i);
    expect(JSON.stringify(catalog)).not.toContain("signed_s3_key");
  });
});
