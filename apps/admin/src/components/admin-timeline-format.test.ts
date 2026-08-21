import { formatAdminTimelineValue, humanizeAdminTimelineToken } from "./admin-timeline-format";

describe("humanizeAdminTimelineToken", () => {
  it("title-cases workflow tokens and keeps short acronyms", () => {
    expect(humanizeAdminTimelineToken("SUBMITTED → APPROVED")).toBe("Submitted → Approved");
    expect(humanizeAdminTimelineToken("ONBOARDING_APPROVED")).toBe("Onboarding Approved");
    expect(humanizeAdminTimelineToken("AML")).toBe("AML");
    expect(humanizeAdminTimelineToken("plain text")).toBe("plain text");
  });
});

describe("formatAdminTimelineValue", () => {
  it("formats ISO dates, booleans, and workflow tokens", () => {
    expect(formatAdminTimelineValue("true")).toBe("Yes");
    expect(formatAdminTimelineValue("false")).toBe("No");
    expect(formatAdminTimelineValue("2026-09-09T00:00:00.000Z")).toBe("09 Sep 2026");
    expect(formatAdminTimelineValue("2026-05-12T14:15:42.000Z")).toMatch(/12 May 2026/);
    expect(formatAdminTimelineValue("plain text")).toBe("plain text");
    expect(formatAdminTimelineValue("APPROVED")).toBe("Approved");
    expect(formatAdminTimelineValue("LOW")).toBe("Low");
    expect(formatAdminTimelineValue("KYC")).toBe("KYC");
  });
});
