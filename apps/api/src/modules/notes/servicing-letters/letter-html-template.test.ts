import { buildServicingLetterHtml, servicingLetterTitle } from "./letter-html-template";

const base = {
  noteReference: "NOTE-1001",
  issuerName: "Acme Sdn Bhd",
  dueDateLabel: "01 Jan 2026",
  daysPastDue: 21,
  outstandingTotalLabel: "MYR 100,000.00",
  indicativeTawidhLabel: "MYR 50.00",
  indicativeGharamahLabel: "MYR 450.00",
  gracePeriodDays: 7,
  arrearsThresholdDays: 14,
  generatedAtLabel: "22 Jan 2026",
};

describe("servicing letter HTML", () => {
  it("renders an arrears notice with platform letterhead fields", () => {
    const html = buildServicingLetterHtml({ kind: "ARREARS", ...base });
    expect(servicingLetterTitle("ARREARS")).toBe("Arrears Notice");
    expect(html).toContain("ARREARS NOTICE");
    expect(html).toContain("NOTE-1001");
    expect(html).toContain("Acme Sdn Bhd");
    expect(html).toContain("Indicative Ta'widh");
    expect(html).not.toContain("Default reason");
  });

  it("renders a default notice with reason and recovery copy", () => {
    const html = buildServicingLetterHtml({
      kind: "DEFAULT",
      ...base,
      defaultDateLabel: "22 Jan 2026",
      defaultReason: "Prolonged non-payment",
    });
    expect(servicingLetterTitle("DEFAULT")).toBe("Default Notice");
    expect(html).toContain("DEFAULT NOTICE");
    expect(html).toContain("Prolonged non-payment");
    expect(html).toContain("pursue recovery");
  });
});
