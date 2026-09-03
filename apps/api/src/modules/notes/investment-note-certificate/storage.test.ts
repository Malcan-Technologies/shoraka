import { buildCertificatePdfObjectKey } from "./storage";
import { certificateAudienceScopeKey } from "./types";

describe("certificate storage keys", () => {
  it("uses deterministic audience paths", () => {
    expect(
      buildCertificatePdfObjectKey({
        noteId: "note-1",
        version: "V01",
        audience: "ADMIN",
      })
    ).toMatch(/investment-note-certificates\/.+\/note-1\/V01\/admin\.pdf$/);
    expect(
      buildCertificatePdfObjectKey({
        noteId: "note-1",
        version: "V01",
        audience: "INVESTOR",
        investorOrganizationId: "org-a",
      })
    ).toMatch(/\/V01\/investor\/org-a\.pdf$/);
  });
});

describe("audience scope uniqueness helper", () => {
  it("encodes nullable investor id so ADMIN/ISSUER stay unique", () => {
    expect(certificateAudienceScopeKey("ADMIN", null)).toBe("ADMIN");
    expect(certificateAudienceScopeKey("ISSUER", null)).toBe("ISSUER");
    expect(certificateAudienceScopeKey("INVESTOR", "org-a")).toBe("INVESTOR:org-a");
  });
});
