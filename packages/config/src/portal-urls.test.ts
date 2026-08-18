import { buildInvestorCampaignUrl, resolveInvestorPortalOrigin } from "./portal-urls";

describe("investor campaign URLs", () => {
  it("uses the investor portal origin, not the current admin origin", () => {
    expect(resolveInvestorPortalOrigin("https://investor.cashsouk.com/")).toBe(
      "https://investor.cashsouk.com"
    );
    expect(resolveInvestorPortalOrigin("http://localhost:3002")).toBe("http://localhost:3002");
  });

  it("builds the live campaign path from note id", () => {
    expect(buildInvestorCampaignUrl("note_abc-1", "https://investor.cashsouk.com")).toBe(
      "https://investor.cashsouk.com/investments/note_abc-1"
    );
    expect(buildInvestorCampaignUrl("note_abc-1", "http://localhost:3002/")).toBe(
      "http://localhost:3002/investments/note_abc-1"
    );
  });
});
