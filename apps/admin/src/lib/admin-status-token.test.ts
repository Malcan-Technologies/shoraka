import {
  getAdminStatusToken,
  getDirectorFinalStatusToken,
  adminActionRowClass,
  adminHeroTintClass,
  adminRejectedRowClass,
  adminTabStatusLabel,
  pickHighestAdminTabToken,
} from "./admin-status-token";

describe("getAdminStatusToken", () => {
  it("uses grey for draft and idle states", () => {
    expect(getAdminStatusToken("DRAFT")).toBe("neutral");
    expect(getAdminStatusToken("ARCHIVED")).toBe("neutral");
    expect(getAdminStatusToken("INACTIVE")).toBe("neutral");
    expect(getAdminStatusToken("CANCELLED")).toBe("neutral");
    expect(getAdminStatusToken("CLOSED")).toBe("neutral");
    expect(getAdminStatusToken("NOT_OPEN")).toBe("neutral");
  });

  it("uses yellow when admin must act", () => {
    expect(getAdminStatusToken("PENDING")).toBe("action");
    expect(getAdminStatusToken("SUBMITTED")).toBe("action");
    expect(getAdminStatusToken("UNDER_REVIEW")).toBe("action");
    expect(getAdminStatusToken("PENDING_APPROVAL")).toBe("action");
    expect(getAdminStatusToken("CONTRACT_PENDING")).toBe("action");
    expect(getAdminStatusToken("CONTRACT_ACCEPTED")).toBe("action");
    expect(getAdminStatusToken("SIGNING_PENDING")).toBe("action");
    expect(getAdminStatusToken("PENDING_ADMIN_REVIEW")).toBe("action");
    expect(getAdminStatusToken("PAID")).toBe("action");
    expect(getAdminStatusToken("FUNDED")).toBe("action");
    expect(getAdminStatusToken("LETTER_GENERATED")).toBe("action");
  });

  it("uses blue when waiting on someone else", () => {
    expect(getAdminStatusToken("OFFER_SENT")).toBe("submitted");
    expect(getAdminStatusToken("CONTRACT_SENT")).toBe("submitted");
    expect(getAdminStatusToken("INVOICES_SENT")).toBe("submitted");
    expect(getAdminStatusToken("AMENDMENT_REQUESTED")).toBe("submitted");
    expect(getAdminStatusToken("PENDING_AMENDMENT")).toBe("submitted");
    expect(getAdminStatusToken("PENDING_ISSUER")).toBe("submitted");
    expect(getAdminStatusToken("CHANGES_REQUESTED")).toBe("submitted");
    expect(getAdminStatusToken("CREATED")).toBe("submitted");
    expect(getAdminStatusToken("PUBLISHED")).toBe("submitted");
    expect(getAdminStatusToken("OPEN")).toBe("submitted");
    expect(getAdminStatusToken("IN_PROGRESS")).toBe("submitted");
    expect(getAdminStatusToken("SENT")).toBe("submitted");
    expect(getAdminStatusToken("SUBMITTED_TO_TRUSTEE")).toBe("submitted");
    expect(getAdminStatusToken("REFUND_INITIATED")).toBe("submitted");
  });

  it("uses green for completed states", () => {
    expect(getAdminStatusToken("COMPLETED")).toBe("success");
    expect(getAdminStatusToken("APPROVED")).toBe("success");
    expect(getAdminStatusToken("SETTLED")).toBe("success");
    expect(getAdminStatusToken("REPAID")).toBe("success");
    expect(getAdminStatusToken("SIGNED")).toBe("success");
  });

  it("uses violet for live active states", () => {
    expect(getAdminStatusToken("ACTIVE")).toBe("active");
    expect(getAdminStatusToken("CONFIRMED")).toBe("active");
  });

  it("returns a yellow row class only for action tokens", () => {
    expect(adminActionRowClass("action")).toContain("status-action-bg");
    expect(adminActionRowClass(true)).toContain("status-action-bg");
    expect(adminActionRowClass("success")).toBe("");
    expect(adminActionRowClass(false)).toBe("");
  });

  it("returns a red row class for arrears and failed notes", () => {
    expect(adminRejectedRowClass(true)).toContain("status-rejected-bg");
    expect(adminRejectedRowClass(false)).toBe("");
  });

  it("uses red for rejected, failed, and arrears", () => {
    expect(getAdminStatusToken("REJECTED")).toBe("rejected");
    expect(getAdminStatusToken("FAILED")).toBe("rejected");
    expect(getAdminStatusToken("WITHDRAWN")).toBe("rejected");
    expect(getAdminStatusToken("DEFAULTED")).toBe("rejected");
    expect(getAdminStatusToken("EXPIRED")).toBe("rejected");
    expect(getAdminStatusToken("VOID")).toBe("rejected");
    expect(getAdminStatusToken("ARREARS")).toBe("rejected");
  });
});

describe("getDirectorFinalStatusToken", () => {
  it("maps pending screening tones to yellow", () => {
    expect(getDirectorFinalStatusToken("warning")).toBe("action");
    expect(getDirectorFinalStatusToken("info")).toBe("action");
  });

  it("maps verified, rejected, and idle tones", () => {
    expect(getDirectorFinalStatusToken("success")).toBe("success");
    expect(getDirectorFinalStatusToken("danger")).toBe("rejected");
    expect(getDirectorFinalStatusToken("expired")).toBe("rejected");
    expect(getDirectorFinalStatusToken("neutral")).toBe("neutral");
  });
});

describe("admin tab token helpers", () => {
  it("picks admin work over waiting, live, and finished states", () => {
    expect(pickHighestAdminTabToken(["success", "submitted", "action"])).toBe("action");
    expect(pickHighestAdminTabToken(["success", "active"])).toBe("active");
    expect(pickHighestAdminTabToken([])).toBe("neutral");
  });

  it("labels tab dots with the admin status meanings", () => {
    expect(adminTabStatusLabel("action")).toBe("Needs action");
    expect(adminTabStatusLabel("submitted")).toBe("Waiting");
    expect(adminTabStatusLabel("active")).toBe("Live");
    expect(adminTabStatusLabel("success")).toBe("Done");
    expect(adminTabStatusLabel("rejected")).toBe("Closed");
    expect(adminTabStatusLabel("neutral")).toBe("Not started");
  });
});

describe("adminHeroTintClass", () => {
  it("mixes the badge fill into the card so the hero is lighter than the chip", () => {
    expect(adminHeroTintClass("submitted")).toContain("--status-submitted-bg");
    expect(adminHeroTintClass("submitted")).toContain("/0.35");
    expect(adminHeroTintClass("action")).toContain("--status-action-bg");
    expect(adminHeroTintClass("success")).toContain("--status-success-bg");
    expect(adminHeroTintClass("rejected")).toContain("--status-rejected-bg");
    expect(adminHeroTintClass("active")).toContain("--status-active-bg");
    expect(adminHeroTintClass("neutral")).toContain("--status-neutral-bg");
  });
});
