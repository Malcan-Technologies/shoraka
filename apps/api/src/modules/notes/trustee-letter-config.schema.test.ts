import { trusteeLetterConfigSchema, updatePlatformFinanceSettingsSchema } from "./schemas";

describe("trusteeLetterConfig schema", () => {
  const baseConfig = {
    trusteeName: "RHB Trustees Berhad",
    trusteeAddressLine1: "Level 11",
    trusteeAddressLine2: "Jalan Tun Razak",
    attentionPerson: "Ms Lim",
    defaultContactPerson: "CashSouk Finance Team",
    authorisedSignatoryLabel: "Authorised Signatories",
    authorisedSignatureImageKey: "platform-finance/sig.png",
    platformDisplayName: "CashSouk Sdn Bhd",
  };

  it("accepts existing letter/signature JSON without email fields", () => {
    expect(trusteeLetterConfigSchema.parse(baseConfig)).toMatchObject(baseConfig);
  });

  it("requires a valid trusteeEmail when auto-send is enabled", () => {
    const result = trusteeLetterConfigSchema.safeParse({
      ...baseConfig,
      autoSendTrusteeEmail: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["trusteeEmail"]);
    }
  });

  it("rejects invalid emails and normalizes CC lists", () => {
    expect(
      trusteeLetterConfigSchema.safeParse({
        ...baseConfig,
        trusteeEmail: "not-an-email",
      }).success
    ).toBe(false);

    const parsed = trusteeLetterConfigSchema.parse({
      ...baseConfig,
      autoSendTrusteeEmail: true,
      trusteeEmail: "  trustee@example.com  ",
      trusteeCcEmails: [" ops@example.com ", "OPS@example.com", "", "legal@example.com"],
    });
    expect(parsed.trusteeEmail).toBe("trustee@example.com");
    expect(parsed.trusteeCcEmails).toEqual(["ops@example.com", "legal@example.com"]);
  });

  it("omits CC addresses that match trusteeEmail", () => {
    const parsed = trusteeLetterConfigSchema.parse({
      ...baseConfig,
      trusteeEmail: "trustee@example.com",
      trusteeCcEmails: ["TRUSTEE@example.com", "ops@example.com"],
    });
    expect(parsed.trusteeCcEmails).toEqual(["ops@example.com"]);
  });

  it("accepts the typed config on platform finance settings update", () => {
    const parsed = updatePlatformFinanceSettingsSchema.parse({
      trusteeLetterConfig: {
        ...baseConfig,
        autoSendTrusteeEmail: false,
        trusteeEmail: "",
      },
    });
    expect(parsed.trusteeLetterConfig?.autoSendTrusteeEmail).toBe(false);
    expect(parsed.trusteeLetterConfig?.trusteeEmail).toBeUndefined();
  });
});
