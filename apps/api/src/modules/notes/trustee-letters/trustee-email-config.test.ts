import { AppError } from "../../../lib/http/error-handler";
import type { TrusteeLetterConfig } from "@cashsouk/types";
import {
  assertTrusteeAutoSendRecipients,
  isTrusteeAutoSendEnabled,
  normalizeTrusteeCcEmails,
} from "./trustee-email-config";

const config: TrusteeLetterConfig = {
  trusteeName: "RHB Trustees Berhad",
  trusteeAddressLine1: "Level 11",
  trusteeAddressLine2: "Jalan Tun Razak",
  attentionPerson: "Ms Lim",
  defaultContactPerson: "CashSouk Finance Team",
  authorisedSignatoryLabel: "Authorised Signatories",
  platformDisplayName: "CashSouk Sdn Bhd",
  autoSendTrusteeEmail: true,
  trusteeEmail: "trustee@example.com",
};

describe("trustee email recipient config", () => {
  it("validates CC addresses and omits any CC equal to To", () => {
    expect(
      assertTrusteeAutoSendRecipients({
        ...config,
        trusteeCcEmails: [" TRUSTEE@example.com ", "ops@example.com", "OPS@example.com"],
      })
    ).toEqual({
      to: "trustee@example.com",
      cc: ["ops@example.com"],
    });
  });

  it("rejects invalid historical CC addresses", () => {
    expect(() =>
      assertTrusteeAutoSendRecipients({
        ...config,
        trusteeCcEmails: ["ops@example.com", "not-an-email"],
      })
    ).toThrow(AppError);

    try {
      assertTrusteeAutoSendRecipients({
        ...config,
        trusteeCcEmails: ["not-an-email"],
      });
      throw new Error("expected AppError");
    } catch (error) {
      expect(error).toMatchObject({
        statusCode: 409,
        code: "TRUSTEE_CC_EMAIL_INVALID",
      });
    }
  });

  it("still rejects a missing To address", () => {
    try {
      assertTrusteeAutoSendRecipients({ ...config, trusteeEmail: undefined });
      throw new Error("expected AppError");
    } catch (error) {
      expect(error).toMatchObject({
        statusCode: 409,
        code: "TRUSTEE_EMAIL_NOT_CONFIGURED",
      });
    }
  });

  it("derives auto-send only from an explicit true flag", () => {
    expect(isTrusteeAutoSendEnabled(config)).toBe(true);
    expect(isTrusteeAutoSendEnabled({ ...config, autoSendTrusteeEmail: false })).toBe(false);
    expect(isTrusteeAutoSendEnabled({ ...config, autoSendTrusteeEmail: undefined })).toBe(false);
    expect(isTrusteeAutoSendEnabled(null)).toBe(false);
    expect(isTrusteeAutoSendEnabled(undefined)).toBe(false);
  });

  it("normalizes CC lists with an optional To exclude", () => {
    expect(
      normalizeTrusteeCcEmails(
        [" trustee@example.com ", "TRUSTEE@example.com", "ops@example.com"],
        "Trustee@example.com"
      )
    ).toEqual(["ops@example.com"]);
  });
});
