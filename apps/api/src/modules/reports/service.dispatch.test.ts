jest.mock("../../lib/prisma", () => ({
  prisma: {},
}));

jest.mock("./origination", () => ({ runOrigination: jest.fn(async () => ({ key: "origination" })) }));
jest.mock("./portfolio-composition", () => ({
  runPortfolioComposition: jest.fn(async () => ({ key: "portfolio_composition" })),
}));
jest.mock("./investor-book", () => ({ runInvestorBook: jest.fn(async () => ({ key: "investor_book" })) }));
jest.mock("./trust-revenue", () => ({ runTrustRevenue: jest.fn(async () => ({ key: "trust_revenue" })) }));

import { REPORT_KEYS } from "@cashsouk/types";
import { runOrigination } from "./origination";
import { runInvestorBook } from "./investor-book";
import { runPortfolioComposition } from "./portfolio-composition";
import { runTrustRevenue } from "./trust-revenue";
import { listReportCatalog, runReport } from "./service";

describe("report dispatcher", () => {
  it("lists every registry key and keeps ComRep unavailable", () => {
    const catalog = listReportCatalog();
    expect(catalog.reports.map((report) => report.key)).toEqual([...REPORT_KEYS]);
    expect(catalog.reports.find((report) => report.key === "comrep")?.available).toBe(false);
  });

  it("routes available keys and returns the ComRep placeholder", async () => {
    await expect(runReport("origination", { from: "2026-09-01", to: "2026-09-09" })).resolves.toMatchObject({
      key: "origination",
    });
    await expect(runReport("portfolio_composition", { groupBy: "issuer" })).resolves.toMatchObject({
      key: "portfolio_composition",
    });
    await expect(runReport("investor_book", { from: "2026-09-01", to: "2026-09-09" })).resolves.toMatchObject({
      key: "investor_book",
    });
    await expect(runReport("trust_revenue", { from: "2026-09-01", to: "2026-09-09" })).resolves.toMatchObject({
      key: "trust_revenue",
    });
    await expect(runReport("comrep", {})).resolves.toMatchObject({
      key: "comrep",
      emptyReason: "Not available yet",
    });
    expect(runOrigination).toHaveBeenCalled();
    expect(runPortfolioComposition).toHaveBeenCalled();
    expect(runInvestorBook).toHaveBeenCalled();
    expect(runTrustRevenue).toHaveBeenCalled();
  });
});
