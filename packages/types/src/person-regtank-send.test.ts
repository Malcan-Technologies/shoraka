import { mergeCtosPartySupplementDocument } from "./ctos-party-supplement-json";
import {
  getCtosPartyCurrentOnboardingRequestId,
  isCurrentCtosPartyOnboardingRequest,
} from "./ctos-party-supplement-json";
import { planPersonRegTankIndividualSend } from "./person-regtank-send";

const now = new Date("2026-09-10T12:00:00.000Z");

describe("planPersonRegTankIndividualSend", () => {
  it("creates when there is no current onboarding request", () => {
    expect(planPersonRegTankIndividualSend({ supplementRoot: null })).toEqual({ action: "create" });
    expect(
      planPersonRegTankIndividualSend({
        supplementRoot: { email: "ali@example.com", requestId: "", status: "", screening: null },
      })
    ).toEqual({ action: "create" });
  });

  it("resends a stored verifyLink that is still valid", () => {
    expect(
      planPersonRegTankIndividualSend({
        now,
        supplementRoot: {
          requestId: "LD-CURRENT",
          status: "IN_PROGRESS",
          verifyLink: "https://verify.example/current",
          verifyLinkExpiresAt: "2026-09-10T13:00:00.000Z",
          email: "ali@example.com",
        },
      })
    ).toEqual({
      action: "resend",
      requestId: "LD-CURRENT",
      verifyLink: "https://verify.example/current",
    });
  });

  it("resends when expiry is unknown and does not assume the link is expired", () => {
    expect(
      planPersonRegTankIndividualSend({
        now,
        supplementRoot: {
          requestId: "LD-CURRENT",
          status: "IN_PROGRESS",
          verifyLink: "https://verify.example/current",
          email: "ali@example.com",
        },
      })
    ).toEqual({
      action: "resend",
      requestId: "LD-CURRENT",
      verifyLink: "https://verify.example/current",
    });
  });

  it("renews an expired same-email link without creating", () => {
    expect(
      planPersonRegTankIndividualSend({
        now,
        supplementRoot: {
          requestId: "LD-CURRENT",
          status: "IN_PROGRESS",
          verifyLink: "https://verify.example/current",
          verifyLinkExpiresAt: "2026-09-10T11:00:00.000Z",
        },
      })
    ).toEqual({
      action: "renew",
      requestId: "LD-CURRENT",
      verifyLink: "https://verify.example/current",
    });
  });

  it("renews when the current request exists but verifyLink is missing", () => {
    expect(
      planPersonRegTankIndividualSend({
        now,
        supplementRoot: { requestId: "LD-CURRENT", status: "IN_PROGRESS" },
      })
    ).toEqual({
      action: "renew",
      requestId: "LD-CURRENT",
      verifyLink: "",
    });
  });

  it("creates after an IN_PROGRESS email change resets the local pipeline", () => {
    const afterSend = mergeCtosPartySupplementDocument(null, {
      onboarding: {
        email: "wrong@example.com",
        status: "IN_PROGRESS",
        requestId: "LD-OLD",
        verifyLink: "https://verify.example/old",
        verifyLinkExpiresAt: "2026-09-10T13:00:00.000Z",
      },
    });
    const afterEmailChange = mergeCtosPartySupplementDocument(afterSend, {
      onboarding: { email: "new@example.com" },
      pipelineReset: true,
      screeningReset: true,
    });
    expect(afterEmailChange.requestId).toBe("");
    expect(afterEmailChange.verifyLink).toBeUndefined();
    expect(afterEmailChange.verifyLinkExpiresAt).toBeUndefined();
    expect(planPersonRegTankIndividualSend({ supplementRoot: afterEmailChange })).toEqual({
      action: "create",
    });
  });

  it("does not treat screening.requestId as the current onboarding request", () => {
    expect(
      planPersonRegTankIndividualSend({
        supplementRoot: {
          requestId: "",
          status: "",
          screening: { requestId: "KYC-OLD", status: "PENDING" },
        },
      })
    ).toEqual({ action: "create" });
  });

  it("rejects WAIT_FOR_APPROVAL and later protected statuses", () => {
    for (const status of [
      "WAIT_FOR_APPROVAL",
      "LIVENESS_PASSED",
      "PENDING_APPROVAL",
      "APPROVED",
      "REJECTED",
      "COMPLETED",
    ]) {
      expect(
        planPersonRegTankIndividualSend({
          supplementRoot: {
            requestId: "LD-CURRENT",
            status,
            verifyLink: "https://verify.example/current",
            verifyLinkExpiresAt: "2026-09-10T11:00:00.000Z",
          },
        }).action
      ).toBe("reject");
    }
  });
});

describe("current Person onboarding requestId", () => {
  it("reads only onboarding_json.requestId and ignores screening.requestId", () => {
    expect(
      getCtosPartyCurrentOnboardingRequestId({
        requestId: "LD-NEW",
        screening: { requestId: "KYC-NEW", status: "PENDING" },
      })
    ).toBe("LD-NEW");
    expect(
      getCtosPartyCurrentOnboardingRequestId({
        requestId: "",
        screening: { requestId: "KYC-OLD", status: "PENDING" },
      })
    ).toBe("");
  });

  it("requires the incoming onboarding requestId to match the current request", () => {
    const current = { requestId: "LD-NEW", referenceId: "org-1_user" };
    expect(isCurrentCtosPartyOnboardingRequest(current, "LD-NEW")).toBe(true);
    expect(isCurrentCtosPartyOnboardingRequest(current, "LD-OLD")).toBe(false);
    expect(isCurrentCtosPartyOnboardingRequest(current, "")).toBe(false);
    expect(isCurrentCtosPartyOnboardingRequest(current, undefined)).toBe(false);
  });

  it("keeps the same requestId current after a token renew merge", () => {
    const afterRenew = mergeCtosPartySupplementDocument(
      {
        requestId: "LD-CURRENT",
        status: "IN_PROGRESS",
        verifyLink: "https://verify.example/?requestId=LD-CURRENT&token=OLD",
        verifyLinkExpiresAt: "2026-09-10T11:00:00.000Z",
      },
      {
        onboarding: {
          requestId: "LD-CURRENT",
          verifyLink: "https://verify.example/?requestId=LD-CURRENT&token=NEW",
          verifyLinkExpiresAt: "2026-09-11T12:00:00.000Z",
        },
      }
    );
    expect(isCurrentCtosPartyOnboardingRequest(afterRenew, "LD-CURRENT")).toBe(true);
    expect(afterRenew.requestId).toBe("LD-CURRENT");
  });
});
