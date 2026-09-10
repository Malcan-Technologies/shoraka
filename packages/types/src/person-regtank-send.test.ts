import { mergeCtosPartySupplementDocument } from "./ctos-party-supplement-json";
import {
  getCtosPartyCurrentOnboardingRequestId,
  isCurrentCtosPartyOnboardingRequest,
} from "./ctos-party-supplement-json";
import {
  PERSON_REGTANK_VERIFY_LINK_UNAVAILABLE,
  planPersonRegTankIndividualSend,
} from "./person-regtank-send";

describe("planPersonRegTankIndividualSend", () => {
  it("creates when there is no current onboarding request", () => {
    expect(planPersonRegTankIndividualSend({ supplementRoot: null })).toEqual({ action: "create" });
    expect(
      planPersonRegTankIndividualSend({
        supplementRoot: { email: "ali@example.com", requestId: "", status: "", screening: null },
      })
    ).toEqual({ action: "create" });
  });

  it("resends the stored verifyLink during IN_PROGRESS without creating", () => {
    expect(
      planPersonRegTankIndividualSend({
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

  it("creates after an IN_PROGRESS email change resets the local pipeline", () => {
    const afterSend = mergeCtosPartySupplementDocument(null, {
      onboarding: {
        email: "wrong@example.com",
        status: "IN_PROGRESS",
        requestId: "LD-OLD",
        verifyLink: "https://verify.example/old",
      },
    });
    const afterEmailChange = mergeCtosPartySupplementDocument(afterSend, {
      onboarding: { email: "new@example.com" },
      pipelineReset: true,
      screeningReset: true,
    });
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

  it("rejects replacement when the stored verifyLink is missing", () => {
    const plan = planPersonRegTankIndividualSend({
      supplementRoot: { requestId: "LD-CURRENT", status: "IN_PROGRESS" },
    });
    expect(plan).toEqual({
      action: "reject",
      code: "VERIFY_LINK_UNAVAILABLE",
      message: PERSON_REGTANK_VERIFY_LINK_UNAVAILABLE,
    });
  });

  it("rejects replacement at WAIT_FOR_APPROVAL", () => {
    expect(
      planPersonRegTankIndividualSend({
        supplementRoot: {
          requestId: "LD-CURRENT",
          status: "WAIT_FOR_APPROVAL",
          verifyLink: "https://verify.example/current",
        },
      }).action
    ).toBe("reject");
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
});
