import type { ReportResult } from "@cashsouk/types";
import {
  buildReportCsv,
  buildReportXlsx,
  neutralizeSpreadsheetFormula,
  reportDownloadName,
} from "./export";

const sample: ReportResult = {
  key: "ageing",
  title: "Portfolio ageing",
  generatedAt: "2026-09-09T00:00:00.000Z",
  asOf: "2026-09-09",
  columns: [
    { key: "noteReference", label: "Note", kind: "text" },
    { key: "daysPastDue", label: "DPD", kind: "number" },
  ],
  rows: [{ noteReference: "NOTE-1", daysPastDue: 12 }],
  summaries: [{ label: "DPD 1-30", count: 1, amount: 1000, percent: 100 }],
};

describe("report export", () => {
  it("builds CSV with headers, rows, and totals", () => {
    const csv = buildReportCsv(sample);
    expect(csv).toContain("Note,DPD");
    expect(csv).toContain("NOTE-1,12");
    expect(csv).toContain("DPD 1-30,1,1000,100");
  });

  it("builds an XLSX buffer", async () => {
    const buffer = await buildReportXlsx(sample);
    expect(buffer.subarray(0, 2).toString()).toBe("PK");
  });

  it("includes the portfolio breakdown in export filenames", () => {
    expect(
      reportDownloadName(
        { ...sample, key: "portfolio_composition" },
        "csv",
        "issuer"
      )
    ).toBe("portfolio_composition-issuer-2026-09-09.csv");
  });

  it("appends portfolio-at-risk rows to the summary", () => {
    const csv = buildReportCsv({
      ...sample,
      portfolioAtRisk: {
        asOf: "2026-09-09",
        bookCount: 1,
        bookOutstanding: 1000,
        pastDue: { count: 1, amount: 1000, percent: 100 },
        par30: { count: 0, amount: 0, percent: 0 },
        par60: { count: 0, amount: 0, percent: 0 },
        par90: { count: 0, amount: 0, percent: 0 },
        defaulted: { count: 0, amount: 0, percent: 0 },
        exclusive: {
          current: { count: 0, amount: 0, percent: 0 },
          dpd1To30: { count: 0, amount: 0, percent: 0 },
          dpd31To60: { count: 0, amount: 0, percent: 0 },
          dpd61To90: { count: 0, amount: 0, percent: 0 },
          dpd90Plus: { count: 0, amount: 0, percent: 0 },
        },
      },
    });
    expect(csv).toContain("PAR30 (DPD > 30)");
    expect(csv).toContain("Past due (DPD > 0)");
  });

  it("prefixes formula-like cells so spreadsheets do not execute them", () => {
    expect(neutralizeSpreadsheetFormula("=HYPERLINK(\"http://evil\")")).toBe("'=HYPERLINK(\"http://evil\")");
    expect(neutralizeSpreadsheetFormula("+cmd")).toBe("'+cmd");
    expect(neutralizeSpreadsheetFormula("-1+1")).toBe("'-1+1");
    expect(neutralizeSpreadsheetFormula("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(neutralizeSpreadsheetFormula("-12.50")).toBe("-12.50");
    const csv = buildReportCsv({
      ...sample,
      rows: [{ noteReference: "=2+2", daysPastDue: 12 }],
    });
    expect(csv).toContain("'=2+2");
    expect(csv).not.toMatch(/(^|,)=2\+2(,|$)/);
  });

  it("quotes cells that contain a carriage return so a suffix cannot become a new formula row", () => {
    const csv = buildReportCsv({
      ...sample,
      rows: [{ noteReference: "Acme\r=HYPERLINK(\"http://evil\")", daysPastDue: 12 }],
    });
    expect(csv).toContain("\"Acme\r=HYPERLINK(\"\"http://evil\"\")\"");
    expect(csv.split("\n").some((line) => line.startsWith("="))).toBe(false);
  });
});
