import { NoteStatus } from "@prisma/client";
import { bookMetricsAsOfFilters } from "./book-metrics-as-of";

const cutoff = new Date("2026-01-01T16:00:00.000Z");

describe("bookMetricsAsOfFilters", () => {
  it("keeps live outstanding as ACTIVE notes only", () => {
    expect(bookMetricsAsOfFilters().outstanding).toEqual({ status: NoteStatus.ACTIVE });
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
});
