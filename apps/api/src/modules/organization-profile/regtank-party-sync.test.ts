import { extractRegTankScreeningPatch } from "./regtank-party-sync";

describe("extractRegTankScreeningPatch (RegTank /v3/kyc/query)", () => {
  it("maps nested individualRiskScore into flattened CTOS screening fields", () => {
    const body = {
      requestId: "KYC00196",
      messageStatus: "DONE",
      status: "Approved",
      individualRiskScore: {
        score: 1.0,
        level: "Low Risk",
        rescreeningFreqInMonth: 12.0,
        riskSettingId: 9408,
      },
    };

    const patch = extractRegTankScreeningPatch(body, "KYC00196");
    expect(patch).toEqual(
      expect.objectContaining({
        provider: "ACURIS",
        requestId: "KYC00196",
        // extractRegTankStatus keeps the raw status string; normalization happens in merge.
        status: "Approved",
        riskLevel: "Low Risk",
        riskScore: 1.0,
        messageStatus: "DONE",
      })
    );

    expect(patch).not.toHaveProperty("possibleMatchCount");
    expect(patch).not.toHaveProperty("blacklistedMatchCount");
  });
});

