import {
  buildPortfolioHref,
  buildTransactionsRedirectHref,
  isPortfolioNavActive,
  isPortfolioTab,
  portfolioTabFromSearchParams,
} from "./portfolio-tabs";

describe("portfolioTabFromSearchParams", () => {
  it("defaults to investments", () => {
    expect(portfolioTabFromSearchParams(null, null)).toBe("investments");
  });

  it("honors an explicit tab", () => {
    expect(portfolioTabFromSearchParams("transactions", null)).toBe("transactions");
    expect(portfolioTabFromSearchParams("investments", "Withdrawal")).toBe("investments");
  });

  it("treats type-only deep links as the transactions tab", () => {
    expect(portfolioTabFromSearchParams(null, "Withdrawal")).toBe("transactions");
  });
});

describe("isPortfolioTab", () => {
  it("accepts only the two portfolio views", () => {
    expect(isPortfolioTab("investments")).toBe(true);
    expect(isPortfolioTab("transactions")).toBe(true);
    expect(isPortfolioTab("activity")).toBe(false);
  });
});

describe("isPortfolioNavActive", () => {
  it("marks the book, note detail, and the old transactions path", () => {
    expect(isPortfolioNavActive("/investments")).toBe(true);
    expect(isPortfolioNavActive("/investments/note-1")).toBe(true);
    expect(isPortfolioNavActive("/transactions")).toBe(true);
    expect(isPortfolioNavActive("/marketplace")).toBe(false);
    expect(isPortfolioNavActive("/activity")).toBe(false);
  });
});

describe("buildPortfolioHref", () => {
  it("omits the default investments tab from the URL", () => {
    expect(buildPortfolioHref({})).toBe("/investments");
    expect(buildPortfolioHref({ tab: "investments" })).toBe("/investments");
  });

  it("keeps the transactions tab and optional type filter", () => {
    expect(buildPortfolioHref({ tab: "transactions" })).toBe("/investments?tab=transactions");
    expect(buildPortfolioHref({ tab: "transactions", type: "Withdrawal" })).toBe(
      "/investments?tab=transactions&type=Withdrawal"
    );
  });
});

describe("buildTransactionsRedirectHref", () => {
  it("preserves withdrawal-history and deposit-return query values", () => {
    expect(
      buildTransactionsRedirectHref({
        type: "Withdrawal",
        depositReturn: "dep_1",
      })
    ).toBe("/investments?tab=transactions&type=Withdrawal&depositReturn=dep_1");
  });

  it("does not let an inbound tab override the cash view", () => {
    expect(buildTransactionsRedirectHref({ tab: "investments" })).toBe(
      "/investments?tab=transactions"
    );
  });
});
