import { presentReportSummary } from "./report-summary-presentation";

describe("presentReportSummary", () => {
  it("uses count as the primary value when there is no amount", () => {
    expect(presentReportSummary({ label: "Investors", count: 3 })).toEqual({
      primary: { kind: "count", value: 3 },
      secondary: [],
    });
    expect(presentReportSummary({ label: "Never invested", count: 0 })).toEqual({
      primary: { kind: "count", value: 0 },
      secondary: [],
    });
    expect(presentReportSummary({ label: "Invested", count: 3, percent: 100 })).toEqual({
      primary: { kind: "count", value: 3 },
      secondary: [{ kind: "percent", value: 100 }],
    });
  });

  it("uses percent as the primary value when there is no amount or count", () => {
    expect(presentReportSummary({ label: "Success rate", percent: 75 })).toEqual({
      primary: { kind: "percent", value: 75 },
      secondary: [],
    });
  });

  it("keeps money as the primary value when an amount is present", () => {
    expect(presentReportSummary({ label: "Available cash", amount: 100 })).toEqual({
      primary: { kind: "amount", value: 100 },
      secondary: [],
    });
    expect(presentReportSummary({ label: "Funded", count: 1, amount: 55000 })).toEqual({
      primary: { kind: "amount", value: 55000 },
      secondary: [{ kind: "count", value: 1 }],
    });
  });
});
