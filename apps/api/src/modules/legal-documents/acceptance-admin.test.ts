import { legalDocumentTypeLabel } from "@cashsouk/types";
import { listLegalAcceptancesQuerySchema } from "./schemas";

describe("legal document acceptances admin query schema", () => {
  it("defaults to accepted_at desc pagination", () => {
    const parsed = listLegalAcceptancesQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(20);
    expect(parsed.sortBy).toBe("accepted_at");
    expect(parsed.sortOrder).toBe("desc");
  });

  it("accepts filters for reporting", () => {
    const parsed = listLegalAcceptancesQuerySchema.parse({
      documentType: "TERMS_OF_USE",
      audience: "ISSUER",
      status: "ACCEPTED",
      search: "acme",
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
    });
    expect(parsed.documentType).toBe("TERMS_OF_USE");
    expect(parsed.audience).toBe("ISSUER");
    expect(parsed.status).toBe("ACCEPTED");
    expect(parsed.search).toBe("acme");
  });
});

describe("legal acceptance export document type", () => {
  it("uses the same friendly type label as the Admin table", () => {
    expect(legalDocumentTypeLabel("TERMS_OF_USE")).toBe("Terms of Use");
    expect(legalDocumentTypeLabel("ISSUER_AGREEMENT")).toBe("Issuer Agreement");
    expect(legalDocumentTypeLabel(null)).toBe("");
  });
});
