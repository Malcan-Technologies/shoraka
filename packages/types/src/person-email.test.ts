import {
  displayedPersonEmail,
  hasPersonOnboardingPipeline,
  isPersonEmailLifecycleLocked,
  isPersonEmailPostCompletionWrite,
  normalizePersonEmail,
  planPersonEmailWrite,
} from "./person-email";
import { isPersonOnboardingStatusBlockedForNormalSend } from "./person-regtank-send";

describe("normalizePersonEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizePersonEmail("  Ada@Acme.TEST ")).toBe("ada@acme.test");
  });

  it("treats blank as empty master", () => {
    expect(normalizePersonEmail("")).toBeNull();
    expect(normalizePersonEmail("   ")).toBeNull();
    expect(normalizePersonEmail(null)).toBeNull();
  });
});

describe("displayedPersonEmail", () => {
  it("prefers the party master over a legacy people-row email", () => {
    expect(
      displayedPersonEmail({ partyEmail: "master@acme.test", personEmail: "legacy@acme.test" })
    ).toBe("master@acme.test");
  });

  it("hydrates from the legacy displayed email before a master is established", () => {
    expect(displayedPersonEmail({ partyEmail: null, personEmail: " legacy@acme.test " })).toBe(
      "legacy@acme.test"
    );
  });

  it("keeps a cleared master empty instead of reviving a legacy email", () => {
    expect(
      displayedPersonEmail({
        partyEmail: null,
        partyEmailIsAuthoritative: true,
        personEmail: "legacy@acme.test",
      })
    ).toBe("");
  });
});

describe("isPersonEmailLifecycleLocked", () => {
  it("is editable before send and during IN_PROGRESS", () => {
    expect(isPersonEmailLifecycleLocked({ supplementRoot: null })).toBe(false);
    expect(
      isPersonEmailLifecycleLocked({
        supplementRoot: { email: "a@b.test", status: "IN_PROGRESS", requestId: "req-1" },
      })
    ).toBe(false);
  });

  it("locks only while KYC is awaiting approval", () => {
    expect(
      isPersonEmailLifecycleLocked({
        supplementRoot: { status: "WAIT_FOR_APPROVAL", requestId: "req-1" },
      })
    ).toBe(true);
    expect(
      isPersonEmailLifecycleLocked({
        onboardingStatus: "PENDING_APPROVAL",
      })
    ).toBe(true);
    expect(
      isPersonEmailLifecycleLocked({
        supplementRoot: { status: "WAIT_FOR_APPROVAL", requestId: "req-live" },
        onboardingStatus: "IN_PROGRESS",
      })
    ).toBe(true);
    expect(
      isPersonEmailLifecycleLocked({
        supplementRoot: { status: " " },
        onboardingStatus: "PENDING_APPROVAL",
      })
    ).toBe(true);
  });

  it("stays editable after KYC approval, AML terminal, or legacy approved", () => {
    expect(
      isPersonEmailLifecycleLocked({
        supplementRoot: { status: "APPROVED", requestId: "req-1" },
        onboardingStatus: "PENDING_APPROVAL",
      })
    ).toBe(false);
    expect(
      isPersonEmailLifecycleLocked({
        supplementRoot: { status: "IN_PROGRESS", screening: { status: "CLEAR", requestId: "aml-1" } },
      })
    ).toBe(false);
    expect(isPersonEmailLifecycleLocked({ legacyKycApproved: true })).toBe(false);
  });
});

describe("planPersonEmailWrite", () => {
  it("seeds empty master without resetting a pipeline that was never sent", () => {
    const plan = planPersonEmailWrite({
      currentMasterEmail: null,
      incomingEmail: "pic@acme.test",
      fillEmptyOnly: true,
    });
    expect(plan).toEqual({
      action: "write",
      email: "pic@acme.test",
      pipelineReset: false,
      screeningReset: false,
      snapshotSupplement: true,
    });
  });

  it("does not overwrite a filled master in fill-empty mode", () => {
    const plan = planPersonEmailWrite({
      currentMasterEmail: "keep@acme.test",
      incomingEmail: "new@acme.test",
      fillEmptyOnly: true,
    });
    expect(plan).toEqual({ action: "noop", email: "keep@acme.test" });
  });

  it("clears a stale snapshot when the master is already empty", () => {
    expect(
      planPersonEmailWrite({
        currentMasterEmail: null,
        incomingEmail: null,
        supplementRoot: {
          email: "legacy@acme.test",
          status: "APPROVED",
          requestId: "req-approved",
        },
      })
    ).toEqual({
      action: "write",
      email: null,
      pipelineReset: false,
      screeningReset: false,
      snapshotSupplement: true,
    });
  });

  it("writes a tombstone when clearing a legacy people-row fallback", () => {
    expect(
      planPersonEmailWrite({
        currentMasterEmail: null,
        incomingEmail: null,
        legacyPeopleEmail: "legacy@acme.test",
        legacyKycApproved: true,
      })
    ).toMatchObject({
      action: "write",
      email: null,
      pipelineReset: false,
    });
  });

  it("does not clear a legacy fallback while KYC is awaiting approval", () => {
    expect(
      planPersonEmailWrite({
        currentMasterEmail: null,
        incomingEmail: null,
        legacyPeopleEmail: "legacy@acme.test",
        onboardingStatus: "PENDING_APPROVAL",
      })
    ).toMatchObject({
      action: "reject",
      code: "DIRECTOR_SHAREHOLDER_NOT_EDITABLE",
    });
  });

  it("seeds the master from the matching snapshot without resetting its active pipeline", () => {
    expect(
      planPersonEmailWrite({
        currentMasterEmail: null,
        incomingEmail: "legacy@acme.test",
        supplementRoot: {
          email: "legacy@acme.test",
          status: "IN_PROGRESS",
          requestId: "req-live",
        },
      })
    ).toMatchObject({
      action: "write",
      pipelineReset: false,
      screeningReset: false,
    });
  });

  it("resets local pipeline/screening on IN_PROGRESS email change", () => {
    const plan = planPersonEmailWrite({
      currentMasterEmail: "old@acme.test",
      incomingEmail: "new@acme.test",
      supplementRoot: { email: "old@acme.test", status: "IN_PROGRESS", requestId: "req-1" },
    });
    expect(plan).toMatchObject({
      action: "write",
      email: "new@acme.test",
      pipelineReset: true,
      screeningReset: true,
    });
    expect(
      planPersonEmailWrite({
        currentMasterEmail: "old@acme.test",
        incomingEmail: "new@acme.test",
        supplementRoot: { email: "old@acme.test", status: "IN_PROGRESS", requestId: "req-live" },
        onboardingStatus: "APPROVED",
      })
    ).toMatchObject({ action: "write", pipelineReset: true, screeningReset: true });
    expect(
      planPersonEmailWrite({
        currentMasterEmail: "old@acme.test",
        incomingEmail: "new@acme.test",
        supplementRoot: { email: "old@acme.test", status: "IN_PROGRESS", requestId: "req-live" },
        legacyKycApproved: true,
      })
    ).toMatchObject({ action: "write", pipelineReset: true, screeningReset: true });
  });

  it("rejects create/patch writes while WAIT_FOR_APPROVAL even if master email is empty", () => {
    expect(
      planPersonEmailWrite({
        currentMasterEmail: null,
        incomingEmail: "new@acme.test",
        supplementRoot: { status: "WAIT_FOR_APPROVAL", requestId: "req-1" },
      }).action
    ).toBe("reject");
    expect(
      planPersonEmailWrite({
        currentMasterEmail: null,
        incomingEmail: "new@acme.test",
        onboardingStatus: "PENDING_APPROVAL",
      }).action
    ).toBe("reject");
  });

  it("persists post-KYC and AML-terminal edits without resetting those pipelines", () => {
    const approved = planPersonEmailWrite({
      currentMasterEmail: "old@acme.test",
      incomingEmail: "new@acme.test",
      supplementRoot: { status: "APPROVED", requestId: "req-1", screening: { status: "CLEAR" } },
    });
    expect(approved).toMatchObject({
      action: "write",
      email: "new@acme.test",
      pipelineReset: false,
      screeningReset: false,
      snapshotSupplement: true,
    });
    expect(
      planPersonEmailWrite({
        currentMasterEmail: "old@acme.test",
        incomingEmail: "new@acme.test",
        supplementRoot: { status: "IN_PROGRESS", screening: { status: "CLEAR", requestId: "aml-1" } },
        screeningStatus: "IN_PROGRESS",
      })
    ).toMatchObject({ action: "write", pipelineReset: false, screeningReset: false });
    expect(
      planPersonEmailWrite({
        currentMasterEmail: "old@acme.test",
        incomingEmail: "new@acme.test",
        legacyKycApproved: true,
      })
    ).toMatchObject({ action: "write", pipelineReset: false, screeningReset: false });
  });
});

describe("editability is split from onboarding send/resend", () => {
  it("keeps send blocked after approval while Person Email stays writable", () => {
    expect(isPersonOnboardingStatusBlockedForNormalSend("APPROVED")).toBe(true);
    expect(isPersonOnboardingStatusBlockedForNormalSend("WAIT_FOR_APPROVAL")).toBe(true);
    expect(isPersonEmailLifecycleLocked({ onboardingStatus: "APPROVED" })).toBe(false);
    expect(isPersonEmailPostCompletionWrite({ onboardingStatus: "APPROVED" })).toBe(true);
  });

  it("writes null to master email when incoming email is blank", () => {
    const plan = planPersonEmailWrite({
      currentMasterEmail: "old@acme.test",
      incomingEmail: "   ",
      supplementRoot: { status: "IN_PROGRESS", requestId: "req-1" },
    });
    expect(plan).toEqual({
      action: "write",
      email: null,
      pipelineReset: true,
      screeningReset: true,
      snapshotSupplement: true,
    });
  });

  it("returns KYC_ALREADY_APPROVED when locked by legacyKycApproved", () => {
    const plan = planPersonEmailWrite({
      currentMasterEmail: "old@acme.test",
      incomingEmail: "new@acme.test",
      legacyKycApproved: true,
      supplementRoot: { status: "IN_PROGRESS", requestId: "req-1" },
    });
    expect(plan).toMatchObject({
      action: "reject",
      code: "KYC_ALREADY_APPROVED",
    });
  });

  it("returns DIRECTOR_SHAREHOLDER_NOT_EDITABLE when locked by AML terminal but not KYC-approval", () => {
    const plan = planPersonEmailWrite({
      currentMasterEmail: "old@acme.test",
      incomingEmail: "new@acme.test",
      supplementRoot: { status: "IN_PROGRESS", screening: { status: "REJECTED", requestId: "aml-1" } },
    });
    expect(plan).toMatchObject({
      action: "reject",
      code: "DIRECTOR_SHAREHOLDER_NOT_EDITABLE",
    });
  });
});

describe("hasPersonOnboardingPipeline", () => {
  it("is false before the first send", () => {
    expect(hasPersonOnboardingPipeline({ email: "a@b.test" })).toBe(false);
    expect(hasPersonOnboardingPipeline(null)).toBe(false);
  });
});
