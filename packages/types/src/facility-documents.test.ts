import {
  FACILITY_DOCUMENT_FIXED_IDS,
  isFacilityDocumentFixedId,
  type FacilityDocumentCatalog,
} from "./facility-documents";

describe("facility document ids", () => {
  it("exposes the facility catalog ids", () => {
    expect(isFacilityDocumentFixedId("underlying-contract")).toBe(true);
    expect(isFacilityDocumentFixedId("letter-of-offer")).toBe(true);
    expect(isFacilityDocumentFixedId("facility-agreement")).toBe(true);
    expect(isFacilityDocumentFixedId("jsg")).toBe(true);
    expect(isFacilityDocumentFixedId("doa")).toBe(true);
    expect(isFacilityDocumentFixedId("prospectus")).toBe(false);
    expect(FACILITY_DOCUMENT_FIXED_IDS.facilityAgreement).toBe("facility-agreement");
  });

  it("keeps catalog DTOs free of storage keys", () => {
    const catalog: FacilityDocumentCatalog = {
      facilityId: "fac-1",
      facilityReference: "FAC-001",
      documents: [
        {
          id: "underlying-contract",
          group: "underlying-contract",
          title: "Underlying contract",
          description: "Commercial contract uploaded with the facility application.",
          available: true,
          unavailableHint: null,
          filename: "contract.pdf",
        },
      ],
    };
    expect(JSON.stringify(catalog)).not.toMatch(/s3/i);
    expect(JSON.stringify(catalog)).not.toContain("s3_key");
  });
});
