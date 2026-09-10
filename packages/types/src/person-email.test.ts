import {
  hasPersonOnboardingPipeline,
  isPersonEmailLifecycleLocked,
  normalizePersonEmail,
  planPersonEmailWrite,
} from "./person-email";

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

describe("isPersonEmailLifecycleLocked", () => {
  it("is editable before send and during IN_PROGRESS", () => {
    expect(isPersonEmailLifecycleLocked({ supplementRoot: null })).toBe(false);
    expect(
      isPersonEmailLifecycleLocked({
        supplementRoot: { email: "a@b.test", status: "IN_PROGRESS", requestId: "req-1" },
      })
    ).toBe(false);
  });

  it("locks WAIT_FOR_APPROVAL, KYC APPROVED, and AML terminal statuses", () => {
    expect(
      isPersonEmailLifecycleLocked({
        supplementRoot: { status: "WAIT_FOR_APPROVAL", requestId: "req-1" },
      })
    ).toBe(true);
    expect(
      isPersonEmailLifecycleLocked({
        supplementRoot: { status: "APPROVED", requestId: "req-1" },
      })
    ).toBe(true);
    expect(
      isPersonEmailLifecycleLocked({
        supplementRoot: { status: "IN_PROGRESS", screening: { status: "CLEAR", requestId: "aml-1" } },
      })
    ).toBe(true);
    expect(
      isPersonEmailLifecycleLocked({
        supplementRoot: { status: "IN_PROGRESS", screening: { status: "REJECTED", requestId: "aml-1" } },
      })
    ).toBe(true);
    expect(isPersonEmailLifecycleLocked({ legacyKycApproved: true })).toBe(true);
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
  });

  it("rejects create/patch writes while WAIT_FOR_APPROVAL even if master email is empty", () => {
    expect(
      planPersonEmailWrite({
        currentMasterEmail: null,
        incomingEmail: "new@acme.test",
        supplementRoot: { status: "WAIT_FOR_APPROVAL", requestId: "req-1" },
      }).action
    ).toBe("reject");
  });

  it("rejects Person Email writes when KYC is APPROVED or AML is terminal", () => {
    expect(
      planPersonEmailWrite({
        currentMasterEmail: "old@acme.test",
        incomingEmail: "new@acme.test",
        supplementRoot: { status: "APPROVED", requestId: "req-1" },
      }).action
    ).toBe("reject");
    expect(
      planPersonEmailWrite({
        currentMasterEmail: "old@acme.test",
        incomingEmail: "new@acme.test",
        supplementRoot: { status: "IN_PROGRESS", screening: { status: "CLEAR", requestId: "aml-1" } },
      }).action
    ).toBe("reject");
  });
});

describe("hasPersonOnboardingPipeline", () => {
  it("is false before the first send", () => {
    expect(hasPersonOnboardingPipeline({ email: "a@b.test" })).toBe(false);
    expect(hasPersonOnboardingPipeline(null)).toBe(false);
  });
});
