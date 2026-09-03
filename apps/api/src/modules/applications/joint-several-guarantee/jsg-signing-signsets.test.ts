import { buildStackedSigningCloudSignsets, countPdfPages } from "./jsg-signing-signsets";

describe("buildStackedSigningCloudSignsets", () => {
  it("returns one signset per signer with stacked tops", () => {
    const signsets = buildStackedSigningCloudSignsets(2, 4);
    expect(signsets).toHaveLength(2);
    expect(signsets[0]?.[0]).toMatchObject({
      fieldtype: "sign",
      pageindex: 4,
      left: 140,
      height: 30,
      width: 100,
    });
    expect(signsets[1]?.[0]?.top).toBeLessThan(signsets[0]?.[0]?.top ?? 0);
  });

  it("returns an empty list when there are no signers", () => {
    expect(buildStackedSigningCloudSignsets(0)).toEqual([]);
  });
});

describe("countPdfPages", () => {
  it("reads /Type /Pages /Count", () => {
    const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Pages /Count 3 /Kids [] >>\nendobj\n");
    expect(countPdfPages(pdf)).toBe(3);
  });

  it("falls back to 1 when the PDF has no page dictionary", () => {
    expect(countPdfPages(Buffer.from("%PDF-1.4 empty"))).toBe(1);
  });
});
