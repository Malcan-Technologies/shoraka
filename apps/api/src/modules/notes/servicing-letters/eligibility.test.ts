import { canIssueDefaultNotice } from "./eligibility";

describe("canIssueDefaultNotice", () => {
  it("rejects notes that have not been marked default", () => {
    expect(canIssueDefaultNotice({ default_marked_at: null })).toBe(false);
  });

  it("allows notices after default is recorded", () => {
    expect(
      canIssueDefaultNotice({
        default_marked_at: new Date("2026-09-10T00:00:00.000Z"),
      })
    ).toBe(true);
  });
});
