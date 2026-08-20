import {
  applicationMatchesListSearch,
  type ApplicationListSearchItem,
} from "./application-list-search";

const app: ApplicationListSearchItem = {
  id: "clabcdefghijklmnop",
  displayReference: "APP-ARF-202608-A82",
  customer: "Ahmad Trading Sdn Bhd",
  invoices: [
    {
      id: "invinvoiceid00001",
      number: "INV-2026-0018",
      displayReference: "INV-ARF-202608-0N5",
    },
  ],
};

const legacyApp: ApplicationListSearchItem = {
  id: "clabcdefghijklmnop",
  displayReference: null,
  customer: "Ahmad Trading Sdn Bhd",
  invoices: [],
};

describe("applicationMatchesListSearch", () => {
  it("matches canonical application reference and prefix", () => {
    expect(applicationMatchesListSearch(app, "APP-ARF-202608-A82")).toBe(true);
    expect(applicationMatchesListSearch(app, "app-arf")).toBe(true);
    expect(applicationMatchesListSearch(app, "  APP-ARF-202608-A82  ")).toBe(true);
  });

  it("matches pasted references with hyphens omitted", () => {
    expect(applicationMatchesListSearch(app, "APPARF202608A82")).toBe(true);
    expect(applicationMatchesListSearch(app, "inv-arf-202608-0n5")).toBe(true);
    expect(applicationMatchesListSearch(app, "INVARF2026080N5")).toBe(true);
  });

  it("matches customer, invoice number, and raw ids", () => {
    expect(applicationMatchesListSearch(app, "ahmad")).toBe(true);
    expect(applicationMatchesListSearch(app, "INV-2026-0018")).toBe(true);
    expect(applicationMatchesListSearch(app, "clabcdefghijklmnop")).toBe(true);
  });

  it("matches short-id fallback when no display reference exists", () => {
    expect(applicationMatchesListSearch(legacyApp, "#IJKLMNOP")).toBe(true);
    expect(applicationMatchesListSearch(legacyApp, "ijklmnop")).toBe(true);
  });

  it("does not match unrelated queries", () => {
    expect(applicationMatchesListSearch(app, "APP-ARF-202608-ZZZ")).toBe(false);
    expect(applicationMatchesListSearch(app, "other customer")).toBe(false);
  });

  it("treats blank query as a match", () => {
    expect(applicationMatchesListSearch(app, "")).toBe(true);
    expect(applicationMatchesListSearch(app, "   ")).toBe(true);
  });
});
