import { sampleInvestmentNoteCertificateSnapshot } from "./certificate-fixture";
import {
  companyRegistrationForAudience,
  investorNameForAudience,
  issuerLegalNameForAudience,
  visibleCertificateInvestors,
} from "./certificate-audience";

describe("certificate audience privacy", () => {
  const snapshot = sampleInvestmentNoteCertificateSnapshot();

  it("admin copy includes every investor row with names visible", () => {
    const rows = visibleCertificateInvestors(snapshot, { audience: "ADMIN" });
    expect(rows.map((row) => row.investorReference)).toEqual(["IVT-A", "IVT-B"]);
    expect(rows.map((row) => investorNameForAudience(row.investorName, "ADMIN"))).toEqual([
      "Alice Tan",
      "Bob Lee",
    ]);
    expect(issuerLegalNameForAudience(snapshot, "ADMIN")).toBe("Helios Manufacturing Sdn Bhd");
    expect(companyRegistrationForAudience(snapshot, "ADMIN")).toBe("1234567-A");
  });

  it("issuer copy includes investor IDs but hides investor names", () => {
    const rows = visibleCertificateInvestors(snapshot, { audience: "ISSUER" });
    expect(rows.map((row) => row.investorReference)).toEqual(["IVT-A", "IVT-B"]);
    expect(rows.map((row) => investorNameForAudience(row.investorName, "ISSUER"))).toEqual([
      "—",
      "—",
    ]);
    expect(issuerLegalNameForAudience(snapshot, "ISSUER")).toBe("Helios Manufacturing Sdn Bhd");
  });

  it("investor copy is that investor's row only", () => {
    const rows = visibleCertificateInvestors(snapshot, {
      audience: "INVESTOR",
      investorOrganizationId: "org-a",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.investorReference).toBe("IVT-A");
    expect(rows[0]?.investorOrganizationId).toBe("org-a");
    expect(investorNameForAudience(rows[0]!.investorName, "INVESTOR")).toBe("Alice Tan");
    expect(issuerLegalNameForAudience(snapshot, "INVESTOR")).toBe("—");
    expect(companyRegistrationForAudience(snapshot, "INVESTOR")).toBe("—");
  });
});
