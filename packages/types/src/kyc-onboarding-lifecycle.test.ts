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

  it("shows Verified when KYC is approved", () => {
    expect(
      getFinalStatusLabel({ onboarding: { status: "APPROVED" } }, { displayMode: "kyc_only" }).label
    ).toBe("Verified");
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
});
