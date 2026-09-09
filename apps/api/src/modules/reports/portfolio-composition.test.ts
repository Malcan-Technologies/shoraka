jest.mock("../../lib/prisma", () => ({ prisma: {} }));

import { NoteServicingStatus } from "@prisma/client";
import {
  aggregateCompositionRows,
  compositionGroupLabel,
  compositionPaymasterName,
  compositionSector,
  compositionStartMonth,
  NOT_RECORDED,
} from "./portfolio-composition";

describe("portfolio composition grouping", () => {
  it("labels start month in MYT", () => {
    expect(compositionStartMonth(new Date("2026-03-01T16:00:00.000Z"))).toBe("Mar 2026");
    expect(compositionStartMonth(null)).toBe(NOT_RECORDED);
  });

  it("falls back to snapshot then Not recorded for paymaster", () => {
    expect(compositionPaymasterName({ legal_name: "ACME Pay" }, { name: "Ignored" })).toBe("ACME Pay");
    expect(compositionPaymasterName(null, { name: "Frozen Paymaster" })).toBe("Frozen Paymaster");
    expect(compositionPaymasterName(null, null)).toBe(NOT_RECORDED);
  });

  it("reads sector from offer details and falls back", () => {
    expect(
      compositionSector({
        offer_details: { campaign_sector: "MANUFACTURING" },
      })
    ).toContain("Manufacturing");
    expect(compositionSector({ offer_details: {} })).toBe(NOT_RECORDED);
  });

  it("returns only the selected grouping", () => {
    const input = {
      startAnchor: new Date("2026-03-01T16:00:00.000Z"),
      issuerSnapshot: { companyName: "Issuer Co" },
      paymaster: { legal_name: "Pay Co" },
      paymasterSnapshot: null,
      invoiceSnapshot: { offer_details: { campaign_sector: "MANUFACTURING" } },
    };
    expect(compositionGroupLabel("start_month", input)).toBe("Mar 2026");
    expect(compositionGroupLabel("issuer", input)).toBe("Issuer Co");
    expect(compositionGroupLabel("paymaster", input)).toBe("Pay Co");
    expect(compositionGroupLabel("sector", input)).toContain("Manufacturing");
  });

  it("computes share and default exposure against the correct denominators", () => {
    const rows = aggregateCompositionRows(
      [
        {
          fundedPrincipal: 100,
          outstandingTotal: 80,
          daysPastDue: 12,
          servicingStatus: NoteServicingStatus.OVERDUE,
          groupLabel: "A",
        },
        {
          fundedPrincipal: 50,
          outstandingTotal: 20,
          daysPastDue: 0,
          servicingStatus: NoteServicingStatus.DEFAULTED,
          groupLabel: "A",
        },
        {
          fundedPrincipal: 200,
          outstandingTotal: 150,
          daysPastDue: 0,
          servicingStatus: NoteServicingStatus.CURRENT,
          groupLabel: "B",
        },
      ],
      250
    );
    expect(rows[0]?.groupLabel).toBe("B");
    expect(rows[0]?.shareOfBookPercent).toBe(60);
    expect(rows[1]?.groupLabel).toBe("A");
    expect(rows[1]?.pastDueCount).toBe(1);
    expect(rows[1]?.defaultedCount).toBe(1);
    expect(rows[1]?.defaultExposurePercent).toBe(20);
  });
});
