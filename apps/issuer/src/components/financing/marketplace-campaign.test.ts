import {
  buildIssuerMarketplaceCampaign,
  issuerCampaignCloseLabel,
  issuerCampaignDaysLeftLabel,
  issuerFailedFundingHelp,
  issuerFundingProgressSummary,
  resolveIssuerMinimumFundingPercent,
} from "./marketplace-campaign";

const raisingNote = {
  noteStatus: "PUBLISHED",
  listingStatus: "PUBLISHED",
  fundingStatus: "OPEN",
  targetAmount: "8000",
  fundedAmount: "4000",
  fundingProgressPercent: 50,
  minimumFundingPercent: "80",
  fundingDeadline: "2026-08-22T16:00:00.000Z",
  investorCount: 2,
};

describe("resolveIssuerMinimumFundingPercent", () => {
  it("defaults missing values to 80", () => {
    expect(resolveIssuerMinimumFundingPercent(null)).toBe(80);
    expect(resolveIssuerMinimumFundingPercent("0")).toBe(80);
    expect(resolveIssuerMinimumFundingPercent("75.4")).toBe(75);
  });
});

describe("buildIssuerMarketplaceCampaign", () => {
  it("marks a published open listing as raising", () => {
    const campaign = buildIssuerMarketplaceCampaign(raisingNote);
    expect(campaign.raising).toBe(true);
    expect(campaign.listingKind).toBe("open");
    expect(campaign.minimumPercent).toBe(80);
    expect(campaign.remainingCapacity).toBe(4000);
    expect(campaign.thresholdReached).toBe(false);
  });

  it("treats a funded closed listing as not raising", () => {
    const campaign = buildIssuerMarketplaceCampaign({
      ...raisingNote,
      noteStatus: "ACTIVE",
      listingStatus: "CLOSED",
      fundingStatus: "FUNDED",
      fundedAmount: "8000",
      fundingProgressPercent: 100,
    });
    expect(campaign.raising).toBe(false);
    expect(campaign.listingKind).toBe("funded");
    expect(campaign.thresholdReached).toBe(true);
  });
});

describe("issuer campaign copy", () => {
  it("formats days left and close date", () => {
    expect(issuerCampaignDaysLeftLabel(3, true)).toBe("3 days left");
    expect(issuerCampaignDaysLeftLabel(1, true)).toBe("1 day left");
    expect(issuerCampaignDaysLeftLabel(0, true)).toBe("Closes today");
    expect(issuerCampaignDaysLeftLabel(null, true)).toBe("Open for funding");
    expect(issuerCampaignDaysLeftLabel(3, false)).toBeNull();
    expect(issuerCampaignCloseLabel("22/08/2026", "3 days left")).toBe(
      "22/08/2026 · 3 days left"
    );
  });

  it("summarises live funding the same way as marketplace", () => {
    const campaign = buildIssuerMarketplaceCampaign(raisingNote);
    expect(issuerFundingProgressSummary(campaign, "RM 4,000")).toBe(
      "50% funded · 80% min · RM 4,000 still open"
    );
    expect(issuerFailedFundingHelp(80)).toContain("80%");
    expect(issuerFailedFundingHelp(80)).toContain("will not receive a disbursement");
  });
});
