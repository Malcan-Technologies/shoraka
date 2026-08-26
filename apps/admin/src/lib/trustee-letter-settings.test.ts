import type { TrusteeLetterConfig } from "@cashsouk/types";
import {
  buildTrusteeLetterConfigPayload,
  isValidTrusteeEmail,
  normalizeTrusteeCcEmails,
  splitTrusteeCcDraft,
  validateTrusteeLetterEmailSettings,
} from "./trustee-letter-settings";

const baseConfig: TrusteeLetterConfig = {
  trusteeName: "RHB Trustees Berhad",
  trusteeAddressLine1: "Level 11",
  trusteeAddressLine2: "Jalan Tun Razak",
  attentionPerson: "Ms Lim",
  defaultContactPerson: "CashSouk Finance Team",
  authorisedSignatoryLabel: "Authorised Signatories",
  platformDisplayName: "CashSouk Sdn Bhd",
};

describe("trustee letter settings", () => {
  it("validates email addresses", () => {
    expect(isValidTrusteeEmail("trustee@example.com")).toBe(true);
    expect(isValidTrusteeEmail("  trustee@example.com  ")).toBe(true);
    expect(isValidTrusteeEmail("not-an-email")).toBe(false);
    expect(isValidTrusteeEmail("")).toBe(false);
  });

  it("does not treat undefined auto-send as enabled", () => {
    const result = validateTrusteeLetterEmailSettings({
      autoSendTrusteeEmail: false,
      trusteeEmail: undefined,
    });
    expect(result.canSave).toBe(true);
    expect(result.trusteeEmailError).toBeNull();
    expect(buildTrusteeLetterConfigPayload(baseConfig).autoSendTrusteeEmail).toBe(false);
  });

  it("requires a valid To address when auto-send is enabled", () => {
    expect(
      validateTrusteeLetterEmailSettings({
        autoSendTrusteeEmail: true,
        trusteeEmail: "",
      })
    ).toEqual({
      trusteeEmailError: "Trustee email is required when automatic email is enabled.",
      trusteeCcError: null,
      canSave: false,
    });

    expect(
      validateTrusteeLetterEmailSettings({
        autoSendTrusteeEmail: true,
        trusteeEmail: "not-an-email",
      }).canSave
    ).toBe(false);

    expect(
      validateTrusteeLetterEmailSettings({
        autoSendTrusteeEmail: true,
        trusteeEmail: "trustee@example.com",
      }).canSave
    ).toBe(true);
  });

  it("normalizes CC emails and rejects invalid draft entries", () => {
    expect(splitTrusteeCcDraft(" ops@example.com , LEGAL@example.com; ")).toEqual([
      "ops@example.com",
      "LEGAL@example.com",
    ]);
    expect(normalizeTrusteeCcEmails([" ops@example.com ", "OPS@example.com", "", "legal@example.com"])).toEqual([
      "ops@example.com",
      "legal@example.com",
    ]);

    expect(
      validateTrusteeLetterEmailSettings({
        autoSendTrusteeEmail: false,
        trusteeCcEmails: ["ops@example.com"],
        ccDraft: "not-an-email",
      }).trusteeCcError
    ).toBe("Each CC address must be a valid email.");
  });

  it("omits empty email fields from the save payload", () => {
    const payload = buildTrusteeLetterConfigPayload(
      {
        ...baseConfig,
        autoSendTrusteeEmail: false,
        trusteeEmail: "  ",
        trusteeCcEmails: ["", "  "],
      },
      "  "
    );
    expect(payload.autoSendTrusteeEmail).toBe(false);
    expect(payload.trusteeEmail).toBeUndefined();
    expect(payload.trusteeCcEmails).toBeUndefined();
  });

  it("includes a valid uncommitted CC draft in the save payload", () => {
    const payload = buildTrusteeLetterConfigPayload(
      {
        ...baseConfig,
        autoSendTrusteeEmail: true,
        trusteeEmail: "  trustee@example.com  ",
        trusteeCcEmails: ["ops@example.com"],
      },
      "legal@example.com"
    );
    expect(payload.trusteeEmail).toBe("trustee@example.com");
    expect(payload.trusteeCcEmails).toEqual(["ops@example.com", "legal@example.com"]);
  });

  it("omits CC addresses that match trusteeEmail case-insensitively", () => {
    const payload = buildTrusteeLetterConfigPayload(
      {
        ...baseConfig,
        trusteeEmail: "trustee@example.com",
        trusteeCcEmails: ["TRUSTEE@example.com", "ops@example.com"],
      },
      "Trustee@example.com"
    );
    expect(payload.trusteeCcEmails).toEqual(["ops@example.com"]);
  });
});
