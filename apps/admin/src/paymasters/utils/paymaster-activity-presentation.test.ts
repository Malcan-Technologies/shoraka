import type { PaymasterActivityEvent } from "@cashsouk/types";
import {
  paymasterActivityCompactDetails,
  paymasterActivityDescription,
} from "./paymaster-activity-presentation";

function event(overrides: Partial<PaymasterActivityEvent> = {}): PaymasterActivityEvent {
  return {
    id: "log-1",
    eventType: "PAYMASTER_CREATED",
    createdAt: "2026-08-10T01:14:00.000Z",
    remark: "ABC Trading Sdn Bhd (202134567890) created as Unverified.",
    actorUserId: "issuer-user",
    actorName: "Issuer User",
    portal: "ISSUER",
    paymasterId: "pm_abc",
    issuerOrganizationId: "org-a",
    issuerName: "Harbour Manufacturing",
    issuerDisplayReference: "ISS-A",
    applicationId: "app-a",
    applicationDisplayReference: "APP-A",
    applicationProductId: "prod-1",
    relatedParty: false,
    verificationStatus: "UNVERIFIED",
    previousStatus: null,
    newStatus: null,
    metadata: { paymaster_id: "pm_abc" },
    ...overrides,
  };
}

describe("Paymaster Activity presentation", () => {
  it("describes Created from the originating issuer application", () => {
    expect(paymasterActivityDescription(event())).toBe(
      "Created from Harbour Manufacturing (ISS-A) application APP-A."
    );
    expect(paymasterActivityCompactDetails(event())).toEqual([
      { key: "status", label: "Status", value: "UNVERIFIED" },
      { key: "relatedParty", label: "Related party", value: "No" },
    ]);
  });

  it("keeps each Linked-to-Issuer event as its own issuer description", () => {
    const linkedB = event({
      id: "linked-b",
      eventType: "PAYMASTER_LINKED_TO_ISSUER",
      issuerOrganizationId: "org-b",
      issuerName: "Issuer B",
      issuerDisplayReference: "ISS-B",
      relatedParty: true,
      verificationStatus: "VERIFIED",
    });
    const linkedC = event({
      id: "linked-c",
      eventType: "PAYMASTER_LINKED_TO_ISSUER",
      issuerOrganizationId: "org-c",
      issuerName: "Issuer C",
      issuerDisplayReference: "ISS-C",
      relatedParty: false,
      verificationStatus: "VERIFIED",
    });
    expect(paymasterActivityDescription(linkedB)).toBe("Issuer B (ISS-B)");
    expect(paymasterActivityDescription(linkedC)).toBe("Issuer C (ISS-C)");
    expect(paymasterActivityCompactDetails(linkedB)).toEqual([
      { key: "relatedParty", label: "Related party", value: "Yes" },
    ]);
  });

  it("shows official identity field diffs for Paymaster Identity Updated", () => {
    const updated = event({
      eventType: "PAYMASTER_IDENTITY_UPDATED",
      remark: "ABC Trading Sdn. Bhd. (202134567890) official identity updated.",
      relatedParty: null,
      metadata: {
        previous: { legalName: "ABC Trading Sdn Bhd" },
        new: { legalName: "ABC Trading Sdn. Bhd." },
      },
    });
    expect(paymasterActivityDescription(updated)).toContain("official identity updated");
    expect(paymasterActivityCompactDetails(updated)).toEqual([
      { key: "legalName", label: "Legal name", value: "ABC Trading Sdn Bhd → ABC Trading Sdn. Bhd." },
    ]);
  });

  it("shows global verification as previous → new status", () => {
    const verified = event({
      eventType: "PAYMASTER_VERIFIED",
      actorName: "Admin A",
      previousStatus: "UNVERIFIED",
      newStatus: "VERIFIED",
      verificationStatus: "VERIFIED",
      relatedParty: null,
      remark: "ABC Trading Sdn Bhd (202134567890) identity reviewed internally. Unverified → Verified.",
    });
    expect(paymasterActivityDescription(verified)).toContain("identity reviewed internally");
    expect(paymasterActivityCompactDetails(verified)).toEqual([
      { key: "status", label: "Status", value: "UNVERIFIED → VERIFIED" },
    ]);
  });
});
