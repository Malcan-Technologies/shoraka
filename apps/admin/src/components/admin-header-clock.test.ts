import { formatAdminHeaderClock } from "./admin-header-clock-format";

describe("formatAdminHeaderClock", () => {
  it("formats the Malaysia civil date and 12-hour time from a UTC instant", () => {
    // 21 Sep 2026 22:55:32 MYT
    const { dateLabel, timeLabel } = formatAdminHeaderClock(new Date("2026-09-21T14:55:32.000Z"));
    expect(dateLabel).toBe("Mon, 21 Sep 2026");
    expect(timeLabel).toBe("10:55:32 PM");
  });

  it("rolls to the next Malaysia day while UTC is still the previous evening", () => {
    // 22 Sep 2026 00:00:05 MYT
    const { dateLabel, timeLabel } = formatAdminHeaderClock(new Date("2026-09-21T16:00:05.000Z"));
    expect(dateLabel).toBe("Tue, 22 Sep 2026");
    expect(timeLabel).toBe("12:00:05 AM");
  });
});
