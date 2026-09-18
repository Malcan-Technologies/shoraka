/**
 * SECTION: Party KYC onboarding lifecycle
 * WHY: People KYC chips must not treat unsent onboarding as In Progress
 */

import { getFinalStatusLabel } from "./director-shareholder-final-status";
import { getKycGroup } from "./director-shareholder-single-status-display";
import {
  canonicalPartyKycOnboardingStatus,
  isKycOnboardingNotStartedToken,
} from "./kyc-onboarding-lifecycle";
import {
  getCtosPartySupplementPipelineStatus,
  getCtosPartySupplementRequestId,
  mergeCtosPartySupplementDocument,
} from "./ctos-party-supplement-json";

describe("canonicalPartyKycOnboardingStatus", () => {
  it("treats a new person with no send evidence as not started", () => {
    expect(canonicalPartyKycOnboardingStatus({ status: null })).toBeNull();
    expect(canonicalPartyKycOnboardingStatus({ status: "" })).toBeNull();
    expect(canonicalPartyKycOnboardingStatus({ status: "NOT_STARTED", requestId: "draft-1" })).toBeNull();
    expect(canonicalPartyKycOnboardingStatus({ status: "PENDING" })).toBeNull();
  });

  it("keeps In Progress after a real Send onboarding request", () => {
    expect(
      canonicalPartyKycOnboardingStatus({
        status: "IN_PROGRESS",
        requestId: "LD80084",
        sentAt: "2026-09-08T00:00:00.000Z",
      })
    ).toBe("IN_PROGRESS");
  });

  it("keeps completed/approved KYC", () => {
    expect(canonicalPartyKycOnboardingStatus({ status: "APPROVED", kycId: "KY1" })).toBe("APPROVED");
    expect(canonicalPartyKycOnboardingStatus({ status: "WAIT_FOR_APPROVAL", requestId: "LD1" })).toBe(
      "WAIT_FOR_APPROVAL"
    );
  });
});

describe("People KYC badge labels", () => {
  it("shows Not Started before Send onboarding", () => {
    expect(getFinalStatusLabel({ onboarding: { status: null } }, { displayMode: "kyc_only" }).label).toBe(
      "Not Started"
    );
    expect(
      getFinalStatusLabel({ onboarding: { status: "NOT_STARTED" } }, { displayMode: "kyc_only" }).label
    ).toBe("Not Started");
    expect(getKycGroup("NOT_STARTED")).toBe("NOT_STARTED");
    expect(isKycOnboardingNotStartedToken("NOT_STARTED")).toBe(true);
  });

  it("shows In Progress after Send onboarding", () => {
    expect(
      getFinalStatusLabel({ onboarding: { status: "IN_PROGRESS" } }, { displayMode: "kyc_only" }).label
    ).toBe("In Progress");
  });

  it("shows Approved when KYC is approved", () => {
    expect(
      getFinalStatusLabel(
        { onboarding: { status: "APPROVED" }, screening: { id: "KYC1", status: "NOT_STARTED" } },
        { displayMode: "kyc_only" }
      ).label
    ).toBe("Approved");
  });

  it("shows Approved when onboarding is APPROVED even if KYC id/reference is missing", () => {
    expect(
      getFinalStatusLabel({ onboarding: { status: "APPROVED" } }, { displayMode: "kyc_only" }).label
    ).toBe("Approved");
  });

  it("keeps AML Not Started when only KYC has a placeholder", () => {
    expect(
      getFinalStatusLabel({
        onboarding: { status: "NOT_STARTED" },
        screening: null,
      }).label
    ).toBe("Not Started");
  });
});

describe("email-only supplement merge", () => {
  it("does not mark KYC in progress when only email is saved", () => {
    const created = mergeCtosPartySupplementDocument(null, {
      onboarding: { email: "a@example.com" },
    });
    expect(getCtosPartySupplementPipelineStatus(created)).toBe("");
    expect(getCtosPartySupplementRequestId(created)).toBe("");
    expect(canonicalPartyKycOnboardingStatus({ status: String(created.status ?? "") })).toBeNull();
  });

  it("clears a prior send when email changes so a failed resend stays Not Started", () => {
    const afterSend = mergeCtosPartySupplementDocument(null, {
      onboarding: {
        email: "a@example.com",
        status: "IN_PROGRESS",
        requestId: "LD1",
        sentAt: "2026-09-08T00:00:00.000Z",
        verifyLink: "https://verify.example/old",
        verifyLinkExpiresAt: "2026-09-08T01:00:00.000Z",
      },
    });
    const afterEmailChange = mergeCtosPartySupplementDocument(afterSend, {
      onboarding: { email: "b@example.com" },
      pipelineReset: true,
      screeningReset: true,
    });
    expect(getCtosPartySupplementPipelineStatus(afterEmailChange)).toBe("");
    expect(afterEmailChange.email).toBe("b@example.com");
    expect(afterEmailChange.verifyLinkExpiresAt).toBeUndefined();
    expect(afterEmailChange.verifyLink).toBeUndefined();
    expect(afterEmailChange.requestId).toBe("");
  });

  it("removes the snapshot email when explicitly cleared", () => {
    const cleared = mergeCtosPartySupplementDocument(
      { email: "old@example.com", status: "APPROVED", requestId: "LD1", screening: null },
      { onboarding: { email: null } }
    );

    expect(cleared).not.toHaveProperty("email");
    expect(cleared.status).toBe("APPROVED");
    expect(cleared.requestId).toBe("LD1");
  });

  it("keeps In Progress when Send onboarding writes a real request", () => {
    const afterSend = mergeCtosPartySupplementDocument(
      { email: "a@example.com", status: "", requestId: "", screening: null },
      {
        onboarding: {
          email: "a@example.com",
          status: "IN_PROGRESS",
          requestId: "LD80084",
          sentAt: "2026-09-08T00:00:00.000Z",
        },
      }
    );
    expect(getCtosPartySupplementPipelineStatus(afterSend)).toBe("IN_PROGRESS");
    expect(getCtosPartySupplementRequestId(afterSend)).toBe("LD80084");
  });

  it("preserves existing riskLevel/riskScore when screening patch omits them", () => {
    const base = mergeCtosPartySupplementDocument(null, {
      onboarding: {
        requestId: "LD86455",
        status: "APPROVED",
      },
      screening: {
        requestId: "KYC00196",
        status: "APPROVED",
        provider: "ACURIS",
        riskLevel: "Low Risk",
        riskScore: "1.0",
        messageStatus: "DONE",
      },
    });

    const after = mergeCtosPartySupplementDocument(base, {
      screening: {
        requestId: "KYC00196",
        status: "APPROVED",
        provider: "ACURIS",
        messageStatus: "DONE",
        // riskLevel/riskScore intentionally omitted
      },
    });

    expect(after.screening?.riskLevel).toBe("Low Risk");
    expect(after.screening?.riskScore).toBe("1.0");
  });

  it("drops previous screening risk evidence when the request ID changes", () => {
    const base = mergeCtosPartySupplementDocument(null, {
      onboarding: {
        requestId: "EOD-STALE",
        status: "APPROVED",
      },
      screening: {
        requestId: "KYC-STALE",
        status: "APPROVED",
        provider: "ACURIS",
        riskLevel: "LOW",
        riskScore: 1,
        messageStatus: "DONE",
      },
    });

    const after = mergeCtosPartySupplementDocument(base, {
      screening: {
        requestId: "KYC00189",
        status: "PENDING",
        provider: "ACURIS",
      },
    });

    expect(after.screening).toMatchObject({
      requestId: "KYC00189",
      status: "PENDING",
    });
    expect(after.screening?.riskLevel).toBeUndefined();
    expect(after.screening?.riskScore).toBeUndefined();
    expect(after.screening?.messageStatus).toBeUndefined();
  });

  it("drops previous onboarding verify metadata when the request ID changes", () => {
    const base = mergeCtosPartySupplementDocument(null, {
      onboarding: {
        requestId: "LD1001",
        status: "WAIT_FOR_APPROVAL",
        verifyLink: "https://verify.example/ld1001",
        verifyLinkExpiresAt: "2026-02-01T00:00:00.000Z",
        referenceId: "ref-ld",
        sentAt: "2026-01-01T00:00:00.000Z",
        lastSentAt: "2026-01-02T00:00:00.000Z",
        sendTimestamps: ["2026-01-01T00:00:00.000Z"],
      },
    });

    const after = mergeCtosPartySupplementDocument(base, {
      onboarding: {
        requestId: "EOD06938",
        status: "APPROVED",
      },
    });

    expect(after.requestId).toBe("EOD06938");
    expect(after.status).toBe("APPROVED");
    expect(after.verifyLink).toBeUndefined();
    expect(after.verifyLinkExpiresAt).toBeUndefined();
    expect(after.referenceId).toBeUndefined();
    expect(after.sentAt).toBeUndefined();
    expect(after.lastSentAt).toBeUndefined();
    expect(after.sendTimestamps).toBeUndefined();
  });
});
