import {
  monthlyIssuerPersonCopy,
  SC_ANNUAL_OFFICER,
  SC_ANNUAL_SHARE_CAPITAL,
  SC_ANNUAL_SHAREHOLDER,
  SC_MONTHLY_BOARD,
  SC_MONTHLY_INVESTOR,
  SC_MONTHLY_SHAREHOLDER,
  SC_MONTHLY_ISSUER_FINANCIAL_LABELS,
} from "./comrep-field-copy";

describe("SC ComRep field copy", () => {
  it("keeps annual shareholder identity as IC/Passport number", () => {
    expect(SC_ANNUAL_SHAREHOLDER.icPassportNumber.label).toBe("IC/Passport number");
  });

  it("keeps annual board identity as Identity Number (NRIC/ Passport No.)", () => {
    expect(SC_ANNUAL_OFFICER.identityNumber.label).toBe("Identity Number (NRIC/ Passport No.)");
  });

  it("uses exact Sdn Bhd and LLP share-capital item labels", () => {
    expect(SC_ANNUAL_SHARE_CAPITAL.ordinaryForSdnBhd.label).toBe("Ordinary (for Sdn Bhd)");
    expect(SC_ANNUAL_SHARE_CAPITAL.limitedLiabilityPartnership.label).toBe("Limited liability partnership");
    expect(SC_ANNUAL_SHARE_CAPITAL.totalLimitedLiabilityPartnership.label).toBe(
      "Total Limited Liability Partnership"
    );
  });

  it("uses monthly investor identification wording, not the annual IC/Passport label", () => {
    expect(SC_MONTHLY_INVESTOR.investorIdentification.label).toBe(
      "Investor Identification (NRIC / Passport / Company Registration No.)"
    );
    expect(SC_MONTHLY_SHAREHOLDER.shareholderIdentity.label).toBe(
      "Shareholder Identity (NRIC/Passport/Company Registration No.)"
    );
    expect(SC_MONTHLY_BOARD.identityNumber.label).toBe("Identity Number (NRIC/Passport No.)");
  });

  it("selects monthly shareholder labels when the issuer person is a shareholder", () => {
    const copy = monthlyIssuerPersonCopy({ shareholder: true, officer: true });
    expect(copy.identity.label).toBe("Identity Number");
    expect(copy.includeRocPrefix).toBe(true);
  });

  it("selects monthly board labels when the issuer person is board/management only", () => {
    const copy = monthlyIssuerPersonCopy({ shareholder: false, officer: true });
    expect(copy.identity.label).toBe("Identity Number");
    expect(copy.includeRocPrefix).toBe(false);
  });

  it("uses '(if applicable)' labels only for the 3 equity optional fields", () => {
    const optionalKeys = Object.entries(SC_MONTHLY_ISSUER_FINANCIAL_LABELS)
      .filter(([, label]) => label.includes("(if applicable)"))
      .map(([key]) => key)
      .sort();

    expect(optionalKeys).toEqual(
      ["equity_share_application", "equity_share_premium", "equity_minority"].sort()
    );
  });
});
