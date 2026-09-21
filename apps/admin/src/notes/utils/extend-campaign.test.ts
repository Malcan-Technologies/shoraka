import { validateExtendCampaignInput } from "./extend-campaign";

describe("validateExtendCampaignInput", () => {
  const now = new Date("2026-09-22T08:00:00.000Z");
  const currentClosesAt = "2026-09-25T08:00:00.000Z";

  it("requires a reason and a later Malaysia datetime", () => {
    expect(
      validateExtendCampaignInput({
        closesAtLocal: "2026-09-26T16:30",
        reason: "   ",
        currentClosesAt,
        now,
      })
    ).toBe("Enter a reason for extending the campaign.");

    expect(
      validateExtendCampaignInput({
        closesAtLocal: "not-a-date",
        reason: "Market still filling",
        currentClosesAt,
        now,
      })
    ).toBe("Enter a valid Malaysia date and time.");

    expect(
      validateExtendCampaignInput({
        closesAtLocal: "2026-09-22T15:00",
        reason: "Market still filling",
        currentClosesAt,
        now,
      })
    ).toBe("New closing date must be after the current time.");

    expect(
      validateExtendCampaignInput({
        closesAtLocal: "2026-09-25T16:00",
        reason: "Market still filling",
        currentClosesAt,
        now,
      })
    ).toBe("New closing date must be after the current closing date.");
  });

  it("rejects a close on or after a fixed maturity date", () => {
    expect(
      validateExtendCampaignInput({
        closesAtLocal: "2026-11-18T16:00",
        reason: "Market still filling",
        currentClosesAt,
        maturityDate: "2026-11-18T00:00:00.000Z",
        now,
      })
    ).toBe("New closing date must be before the note's maturity date.");
  });

  it("accepts a later close before maturity", () => {
    expect(
      validateExtendCampaignInput({
        closesAtLocal: "2026-09-30T16:30",
        reason: "Market still filling",
        currentClosesAt,
        maturityDate: "2026-11-18T00:00:00.000Z",
        now,
      })
    ).toBeNull();
  });
});
