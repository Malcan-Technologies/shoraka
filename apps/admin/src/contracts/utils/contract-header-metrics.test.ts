jest.mock("@cashsouk/config", () => ({
  formatCurrency: (amount: number) =>
    `RM ${amount.toLocaleString("en-MY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
}));

import {
  getContractHeaderEndDate,
  getContractHeaderMetrics,
  resolveContractHeaderDescription,
} from "./contract-header-metrics";

describe("getContractHeaderMetrics", () => {
  it("formats start date, contract value, and financing", () => {
    const rows = Object.fromEntries(
      getContractHeaderMetrics({
        start_date: "2026-01-15T12:00:00.000Z",
        end_date: "2026-12-31T12:00:00.000Z",
        value: 2_500_000,
        financing: 1_250_000,
      }).map((row) => [row.label, row.value])
    );

    expect(rows["Start date"]).toBe("15 Jan 2026");
    expect(rows["Contract value"]).toBe("RM 2,500,000.00");
    expect(rows["Financing"]).toBe("RM 1,250,000.00");
    expect(rows["End date"]).toBeUndefined();
  });

  it("uses Not set when dates and amounts are missing", () => {
    expect(getContractHeaderMetrics(null)).toEqual([
      { label: "Start date", value: "Not set" },
      { label: "Contract value", value: "Not set" },
      { label: "Financing", value: "Not set" },
    ]);
  });

  it("parses formatted money strings from the contract JSON", () => {
    const rows = Object.fromEntries(
      getContractHeaderMetrics({
        value: "RM 1,250,000.00",
        financing: "900000",
      }).map((row) => [row.label, row.value])
    );

    expect(rows["Contract value"]).toBe("RM 1,250,000.00");
    expect(rows["Financing"]).toBe("RM 900,000.00");
  });
});

describe("getContractHeaderEndDate", () => {
  it("formats the facility end date for the hero KPI", () => {
    expect(getContractHeaderEndDate({ end_date: "2026-12-31T12:00:00.000Z" })).toBe("31 Dec 2026");
    expect(getContractHeaderEndDate(null)).toBe("Not set");
  });
});

describe("resolveContractHeaderDescription", () => {
  it("returns a distinct description and skips duplicates of the title", () => {
    expect(
      resolveContractHeaderDescription({
        title: "Supply agreement",
        description: "  Annual grocery supply  ",
      })
    ).toBe("Annual grocery supply");
    expect(
      resolveContractHeaderDescription({
        title: "Supply agreement",
        description: "Supply agreement",
      })
    ).toBeNull();
    expect(
      resolveContractHeaderDescription({
        title: "Supply agreement",
        contractDetails: { description: "From snapshot" },
      })
    ).toBe("From snapshot");
  });
});
