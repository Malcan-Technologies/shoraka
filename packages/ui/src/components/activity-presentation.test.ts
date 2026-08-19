import {
  getActivityHref,
  getActivityStatusLabel,
  getActivityStatusToken,
  getDefaultActivityDomains,
  sameActivityDomainSet,
} from "@cashsouk/types";

describe("getActivityStatusToken", () => {
  it("maps issuer-facing events to viewer-centric tokens", () => {
    expect(getActivityStatusToken("CONTRACT_OFFER_SENT")).toBe("action");
    expect(getActivityStatusToken("APPLICATION_AMENDMENTS_REQUESTED")).toBe("action");
    expect(getActivityStatusToken("APPLICATION_SUBMITTED")).toBe("submitted");
    expect(getActivityStatusToken("NOTE_ACTIVATED")).toBe("active");
    expect(getActivityStatusToken("APPLICATION_COMPLETED")).toBe("success");
    expect(getActivityStatusToken("NOTE_FUNDING_FAILED")).toBe("rejected");
    expect(getActivityStatusToken("APPLICATION_WITHDRAWN")).toBe("neutral");
  });

  it("does not use leftover indigo/sky tokens", () => {
    expect(getActivityStatusToken("APPLICATION_SUBMITTED")).not.toBe("in-progress" as never);
    expect(getActivityStatusLabel("CONTRACT_OFFER_SENT")).toBe("Action needed");
    expect(getActivityStatusLabel("NOTE_PUBLISHED")).toBe("Waiting");
    expect(getActivityStatusLabel("NOTE_ACTIVATED")).toBe("Live");
  });
});

describe("getDefaultActivityDomains", () => {
  it("returns all domains until onboarding is complete", () => {
    expect(getDefaultActivityDomains("issuer")).toEqual([]);
    expect(getDefaultActivityDomains("investor", { onboardingComplete: false })).toEqual([]);
  });

  it("hides onboarding after the org is approved", () => {
    expect(getDefaultActivityDomains("issuer", { onboardingComplete: true })).toEqual([
      "application",
      "note",
      "signing",
    ]);
    expect(getDefaultActivityDomains("investor", { onboardingComplete: true })).toEqual([
      "note",
      "payment",
    ]);
  });
});

describe("sameActivityDomainSet", () => {
  it("compares domain filters without order", () => {
    expect(sameActivityDomainSet(["note", "application"], ["application", "note"])).toBe(true);
    expect(sameActivityDomainSet(["note"], ["application", "note"])).toBe(false);
  });
});

describe("getActivityHref", () => {
  it("prefers the most specific issuer object", () => {
    expect(
      getActivityHref(
        {
          domain: "application",
          event_type: "INVOICE_OFFER_SENT",
          references: {
            applicationId: "app_1",
            contractId: "con_1",
            invoiceId: "inv_1",
          },
        },
        "issuer"
      )
    ).toBe("/financing/invoices/inv_1");

    expect(
      getActivityHref(
        {
          domain: "application",
          event_type: "CONTRACT_OFFER_SENT",
          references: { applicationId: "app_1", contractId: "con_1" },
        },
        "issuer"
      )
    ).toBe("/financing/contracts/con_1");

    expect(
      getActivityHref(
        {
          domain: "application",
          event_type: "APPLICATION_SUBMITTED",
          references: { applicationId: "app_1" },
        },
        "issuer"
      )
    ).toBe("/applications/app_1");
  });

  it("links notes in each portal", () => {
    expect(
      getActivityHref(
        { domain: "note", event_type: "NOTE_PUBLISHED", references: { noteId: "note_1" } },
        "issuer"
      )
    ).toBe("/financing/notes/note_1");

    expect(
      getActivityHref(
        { domain: "note", event_type: "INVESTMENT_COMMITTED", references: { noteId: "note_1" } },
        "investor"
      )
    ).toBe("/investments/note_1");
  });
});
