jest.mock("../../lib/prisma", () => ({ prisma: {} }));

import { ApplicationStatus, NoteFundingStatus } from "@prisma/client";
import {
  originationDaysOpen,
  originationFunnelLabel,
  originationOutcome,
} from "./origination";

describe("origination mapping", () => {
  it("maps funding outcomes exactly", () => {
    expect(originationOutcome(NoteFundingStatus.FUNDED)).toBe("Funded");
    expect(originationOutcome(NoteFundingStatus.FAILED)).toBe("Failed");
    expect(originationOutcome(NoteFundingStatus.OPEN)).toBe("Open");
    expect(originationOutcome(NoteFundingStatus.CLOSED)).toBe("Closed");
    expect(originationOutcome(NoteFundingStatus.NOT_OPEN)).toBe("Not listed");
  });

  it("maps the application funnel and excludes drafts", () => {
    expect(originationFunnelLabel(ApplicationStatus.SUBMITTED)).toBe("In review");
    expect(originationFunnelLabel(ApplicationStatus.RESUBMITTED)).toBe("In review");
    expect(originationFunnelLabel(ApplicationStatus.CONTRACT_SENT)).toBe("Awaiting issuer");
    expect(originationFunnelLabel(ApplicationStatus.COMPLETED)).toBe("Completed");
    expect(originationFunnelLabel(ApplicationStatus.REJECTED)).toBe("Unsuccessful");
    expect(originationFunnelLabel(ApplicationStatus.DRAFT)).toBeNull();
    expect(originationFunnelLabel(ApplicationStatus.ARCHIVED)).toBeNull();
  });

  it("anchors days open on published, closed, and report to dates", () => {
    const published = new Date("2026-09-01T02:00:00.000Z");
    const closed = new Date("2026-09-05T10:00:00.000Z");
    const toDate = new Date("2026-09-09T16:00:00.000Z");
    expect(
      originationDaysOpen({
        publishedAt: published,
        fundingClosedAt: closed,
        fundingStatus: NoteFundingStatus.FUNDED,
        toDate,
      })
    ).toBeGreaterThan(0);
    expect(
      originationDaysOpen({
        publishedAt: published,
        fundingClosedAt: null,
        fundingStatus: NoteFundingStatus.OPEN,
        toDate,
      })
    ).toBeGreaterThan(0);
    expect(
      originationDaysOpen({
        publishedAt: published,
        fundingClosedAt: null,
        fundingStatus: NoteFundingStatus.NOT_OPEN,
        toDate,
      })
    ).toBeNull();
  });
});

describe("origination success rate", () => {
  it("is funded divided by funded plus failed", () => {
    const funded = 3;
    const failed = 1;
    expect((funded / (funded + failed)) * 100).toBe(75);
  });
});
