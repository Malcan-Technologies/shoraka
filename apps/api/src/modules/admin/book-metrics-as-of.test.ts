import { NoteStatus } from "@prisma/client";
import { bookMetricsAsOfFilters, bookMetricsDueSoonWindow } from "./book-metrics-as-of";

const cutoff = new Date("2026-01-01T16:00:00.000Z");

describe("bookMetricsAsOfFilters", () => {
  it("keeps live outstanding as ACTIVE notes only", () => {
    expect(bookMetricsAsOfFilters().outstanding).toEqual({ status: NoteStatus.ACTIVE });
    expect(bookMetricsAsOfFilters().inFunding).toEqual({
      status: { in: [NoteStatus.PUBLISHED, NoteStatus.FUNDING] },
    });
  });

  it("includes notes repaid after Malaysia midnight in the closed-day outstanding book", () => {
    const filters = bookMetricsAsOfFilters(cutoff);
    expect(filters.outstanding).toEqual(
      expect.objectContaining({
        OR: expect.arrayContaining([
          { status: NoteStatus.ACTIVE },
          expect.objectContaining({
            status: NoteStatus.REPAID,
            repaid_at: { gte: cutoff },
          }),
        ]),
      })
    );
  });

  it("keeps same-morning arrears on the outstanding book instead of yesterday's arrears", () => {
    const filters = bookMetricsAsOfFilters(cutoff);
    expect(JSON.stringify(filters.arrears)).toContain("\"lt\":");
    expect(JSON.stringify(filters.outstanding)).toContain("\"gte\":");
    expect(JSON.stringify(filters.outstanding)).toContain("ARREARS");
  });

  it("reconstructs in-funding from publication and funding-close timestamps", () => {
    expect(bookMetricsAsOfFilters(cutoff).inFunding).toEqual({
      published_at: { not: null, lt: cutoff },
      OR: [{ funding_closed_at: null }, { funding_closed_at: { gte: cutoff } }],
    });
  });
});

describe("bookMetricsDueSoonWindow", () => {
  it("anchors the closed-day window on the labeled Malaysia date", () => {
    const window = bookMetricsDueSoonWindow(
      new Date("2026-01-01T16:30:00.000Z"),
      new Date("2026-01-01T16:00:00.000Z")
    );
    expect(window.start.toISOString()).toBe("2025-12-31T16:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-01-07T16:00:00.000Z");
  });
});
