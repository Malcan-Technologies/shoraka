import { ApplicationLogEventType } from "../applications/logs/types";
import { buildPaymasterIdentityRemark } from "./identity-audit";
import {
  parseRegistrationLookup,
  parseRelatedPartyFlag,
  parseSubmittedIdentity,
  submittedIdentityConflictsWithMaster,
} from "./identity";

describe("Paymaster identity helpers", () => {
  it("normalizes 12-digit Malaysian registration numbers only", () => {
    expect(parseRegistrationLookup("2021-3456-7890")).toBe("202134567890");
    expect(parseRegistrationLookup("123")).toBeNull();
    expect(parseRegistrationLookup("ABC Trading")).toBeNull();
  });

  it("does not treat unanswered related-party as false", () => {
    expect(parseRelatedPartyFlag(undefined)).toBeNull();
    expect(parseRelatedPartyFlag("no")).toBeNull();
    expect(parseRelatedPartyFlag(true)).toBe(true);
    expect(parseRelatedPartyFlag(false)).toBe(false);
  });

  it("parses submitted identity by registration, never by name", () => {
    const parsed = parseSubmittedIdentity({
      name: " ABC Trading Sdn Bhd ",
      ssm_number: "202134567890",
      country: "my",
      entity_type: "Private Limited Company (Sdn Bhd)",
    });
    expect(parsed?.registrationNumber).toBe("202134567890");
    expect(parsed?.legalName).toBe("ABC Trading Sdn Bhd");
    expect(parseSubmittedIdentity({ name: "ABC Trading Sdn Bhd" })).toBeNull();
  });

  it("detects submitted identity that conflicts with the master", () => {
    const master = {
      legal_name: "ABC Trading Sdn Bhd",
      entity_type: "Private Limited Company (Sdn Bhd)",
      registration_country: "MY",
      registration_number: "202134567890",
    };
    const matching = parseSubmittedIdentity({
      name: "ABC Trading Sdn Bhd",
      ssm_number: "202134567890",
      country: "MY",
      entity_type: "Private Limited Company (Sdn Bhd)",
    });
    const conflicting = parseSubmittedIdentity({
      name: "Wrong Name Sdn Bhd",
      ssm_number: "202134567890",
      country: "SG",
      entity_type: "Partnership",
    });
    expect(matching && submittedIdentityConflictsWithMaster(master, matching)).toBe(false);
    expect(conflicting && submittedIdentityConflictsWithMaster(master, conflicting)).toBe(true);
  });
});

describe("Paymaster identity audit remarks", () => {
  it("uses business labels in remarks, not raw event codes", () => {
    expect(
      buildPaymasterIdentityRemark({
        eventType: ApplicationLogEventType.PAYMASTER_CREATED,
        legalName: "ABC Trading Sdn Bhd",
        registrationNumber: "202134567890",
      })
    ).toBe("ABC Trading Sdn Bhd (202134567890) created as Unverified.");
    expect(
      buildPaymasterIdentityRemark({
        eventType: ApplicationLogEventType.PAYMASTER_LINKED_TO_ISSUER,
        legalName: "ABC Trading Sdn Bhd",
        registrationNumber: "202134567890",
      })
    ).toBe("ABC Trading Sdn Bhd (202134567890) linked to this issuer.");
    expect(
      buildPaymasterIdentityRemark({
        eventType: ApplicationLogEventType.PAYMASTER_VERIFIED,
        legalName: "ABC Trading Sdn Bhd",
        registrationNumber: "202134567890",
      })
    ).toBe("ABC Trading Sdn Bhd (202134567890) identity reviewed internally. Unverified → Verified.");
  });
});
