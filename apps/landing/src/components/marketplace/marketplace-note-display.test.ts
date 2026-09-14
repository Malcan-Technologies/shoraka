import {
  formatCompactMarketplaceAmount,
  formatCompactMarketplaceAmountPair,
  marketplaceCardDaysLeftLabel,
} from "@cashsouk/types";
import { marketplaceNotesCountLabel } from "./marketplace-note-display";

describe("marketplace compact amounts", () => {
  it("formats millions and thousands as in the marketplace mockup", () => {
    expect(formatCompactMarketplaceAmount(1_080_000)).toBe("RM 1.1m");
    expect(formatCompactMarketplaceAmount(405_000)).toBe("RM 405k");
    expect(formatCompactMarketplaceAmount(500)).toBe("RM 500");
    expect(formatCompactMarketplaceAmountPair(1_080_000, 1_500_000)).toBe("RM 1.1m / 1.5m");
  });

  it("labels days left and listing counts", () => {
    expect(
      marketplaceCardDaysLeftLabel({ daysLeft: 6, listingKind: "open" })
    ).toBe("6 days left");
    expect(
      marketplaceCardDaysLeftLabel({ daysLeft: null, listingKind: "open" })
    ).toBe("Open");
    expect(marketplaceNotesCountLabel(1)).toBe("1 note");
    expect(marketplaceNotesCountLabel(3)).toBe("3 notes");
  });
});
