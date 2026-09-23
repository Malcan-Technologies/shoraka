import { ADMIN_DOCUMENT_DESCRIPTIONS, FACILITY_DOCUMENT_FIXED_IDS } from "@cashsouk/types";
import { buildFacilityDocumentCatalog, type FacilityDocumentCatalogSnapshot } from "./catalog";

function snapshot(
  overrides: Partial<FacilityDocumentCatalogSnapshot> = {}
): FacilityDocumentCatalogSnapshot {
  return {
    facilityId: "fac-1",
    facilityReference: "FAC-001",
    originatingApplicationId: "app-1",
    underlyingContract: null,
    envelope: null,
    jsg: null,
    facilityAgreement: null,
    doa: null,
    letterOfOffer: { hasContract: true, offerSent: false, declaredOnProduct: true },
    shoraka: [],
    faPackageGeneratedAt: null,
    ...overrides,
  };
}

describe("facility document catalog", () => {
  it("keeps five groups visible when nothing is available and never exposes storage keys", () => {
    const catalog = buildFacilityDocumentCatalog(snapshot());
    expect(catalog.documents.map((row) => row.group)).toEqual([
      "underlying-contract",
      "letter-of-offer",
      "facility-agreement",
      "jsg",
      "deed-of-assignment",
    ]);
    expect(catalog.documents.every((row) => row.available === false)).toBe(true);
    expect(catalog.documents[0]?.id).toBe(FACILITY_DOCUMENT_FIXED_IDS.underlyingContract);
    expect(catalog.documents[0]?.description).toBe(ADMIN_DOCUMENT_DESCRIPTIONS.underlyingContract);
    expect(JSON.stringify(catalog)).not.toMatch(/s3/i);
    expect(JSON.stringify(catalog)).not.toContain("signed_s3_key");
  });

  it("enables the underlying contract without putting the storage key on the row", () => {
    const catalog = buildFacilityDocumentCatalog(
      snapshot({
        underlyingContract: { s3Key: "uploads/contract.pdf", fileName: "Test PDF.pdf" },
      })
    );
    const row = catalog.documents.find((item) => item.id === "underlying-contract");
    expect(row?.available).toBe(true);
    expect(row?.filename).toBe("Test PDF.pdf");
    expect(JSON.stringify(row)).not.toContain("uploads/contract.pdf");
  });

  it("keeps the Facility Agreement row as a compiled package and never exposes storage keys", () => {
    const catalog = buildFacilityDocumentCatalog(snapshot());
    const fa = catalog.documents.find((row) => row.id === "facility-agreement");
    expect(fa?.title).toBe("Facility Agreement Package");
    expect(fa?.description).toBe(ADMIN_DOCUMENT_DESCRIPTIONS.facilityAgreementPackage);
    expect(fa?.available).toBe(false);
  });

  it("enables the compiled FA package only when signed FA and Letter of Offer are ready", () => {
    const signedFa = {
      id: "doc-fa",
      name: "Facility Agreement",
      template_ref: "facility_agreement",
      signed_s3_key: "applications/app-1/fa.pdf",
      signed_file_sha256: "hash",
      status: "COMPLETED",
    };
    const envelope = {
      id: "env-1",
      status: "COMPLETED",
      application_id: "app-1",
      contract_id: "fac-1",
      invoice_id: null,
      completed_at: new Date(),
      documents: [],
    };
    const withoutLo = buildFacilityDocumentCatalog(
      snapshot({
        envelope,
        facilityAgreement: signedFa,
        letterOfOffer: { hasContract: true, offerSent: false, declaredOnProduct: true },
      })
    );
    expect(withoutLo.documents.find((row) => row.id === "facility-agreement")?.available).toBe(
      false
    );

    const catalog = buildFacilityDocumentCatalog(
      snapshot({
        envelope,
        facilityAgreement: signedFa,
        letterOfOffer: { hasContract: true, offerSent: true, declaredOnProduct: true },
        faPackageGeneratedAt: "2026-09-23T00:00:00.000Z",
      })
    );
    const fa = catalog.documents.find((row) => row.id === "facility-agreement");
    expect(fa?.available).toBe(true);
    expect(fa?.title).toBe("Facility Agreement Package");
    expect(fa?.filename).toBe("Facility-Agreement-Package-FAC-001.pdf");
    expect(fa?.generatedAt).toBe("2026-09-23T00:00:00.000Z");
    expect(catalog.documents.find((row) => row.id === "letter-of-offer")?.available).toBe(true);
    expect(JSON.stringify(catalog)).not.toContain("applications/app-1/fa.pdf");
  });
});
