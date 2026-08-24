jest.mock("@cashsouk/config", () => ({
  formatCurrency: (amount: number) =>
    `RM ${amount.toLocaleString("en-MY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
}));

import { getNoteCommercialTermRows } from "./note-commercial-terms";
import type { NoteDetail } from "@cashsouk/types";

function termNote(overrides: Partial<NoteDetail> = {}): NoteDetail {
  return {
    profitRatePercent: 10,
    platformFeeRatePercent: 1.5,
    serviceFeeRatePercent: 15,
    tawidhRateCapPercent: 1,
    gharamahRateCapPercent: 9,
    invoiceSnapshot: { offer_details: { risk_rating: "B" } },
    withdrawals: [],
    contractSnapshot: null,
    fundedAmount: 100_000,
    targetAmount: 100_000,
    invoiceAmount: 250_000,
    settlementAmount: 250_000,
    requestedAmount: 250_000,
    ...overrides,
  } as NoteDetail;
}

describe("getNoteCommercialTermRows", () => {
  it("omits invoice amount because it equals settlement amount", () => {
    const labels = getNoteCommercialTermRows(termNote()).map((row) => row.label);
    expect(labels).not.toContain("Invoice amount");
    expect(labels).toEqual([
      "Paymaster",
      "Risk rating",
      "Profit rate",
      "Drawdown fee",
      "Service fee",
      "Late caps",
    ]);
  });

  it("formats rates, fees, and late caps", () => {
    const rows = Object.fromEntries(
      getNoteCommercialTermRows(termNote()).map((row) => [row.label, row.value])
    );
    expect(rows["Paymaster"]).toBe("—");
    expect(rows["Risk rating"]).toBe("B");
    expect(rows["Profit rate"]).toBe("10% p.a.");
    expect(rows["Drawdown fee"]).toBe("1.5% at disbursement");
    expect(rows["Service fee"]).toBe("15% of investor profit");
    expect(rows["Late caps"]).toBe("Ta'widh 1%, Gharamah 9%");
  });

  it("shows the paymaster name", () => {
    const rows = Object.fromEntries(
      getNoteCommercialTermRows(termNote({ paymasterName: "Kementerian Kerja Raya" })).map(
        (row) => [row.label, row.value]
      )
    );
    expect(rows["Paymaster"]).toBe("Kementerian Kerja Raya");
  });

  it("includes a charged facility fee when present", () => {
    const rows = getNoteCommercialTermRows(
      termNote({
        withdrawals: [
          {
            withdrawalType: "ISSUER_DISBURSEMENT",
            facilityFeeCharged: 1250,
          },
        ] as NoteDetail["withdrawals"],
      })
    );
    const facility = rows.find((row) => row.label === "Facility fee");
    expect(facility).toBeDefined();
    expect(facility?.value).toBe("RM 1,250.00 at disbursement");
    expect(rows.map((row) => row.label)).toEqual([
      "Paymaster",
      "Risk rating",
      "Profit rate",
      "Drawdown fee",
      "Facility fee",
      "Service fee",
      "Late caps",
    ]);
  });

  it("shows the exact v1 facility collection instead of grandfather funded×rate math", () => {
    const rows = getNoteCommercialTermRows(
      termNote({
        fundedAmount: 100_000,
        targetAmount: 100_000,
        feeSchedule: {
          version: 1,
          facilityFeeCollectAmount: 800,
          additionalFees: [],
        },
        contractSnapshot: {
          contract_details: {
            approved_facility: 200_000,
            facility_fee_rate_percent: 1,
            facility_fee_paid_amount: 0,
          },
        },
      })
    );
    const facility = rows.find((row) => row.label === "Facility fee");
    expect(facility?.value).toBe("RM 800.00 at disbursement");
  });

  it("keeps the v1 collection amount after a grandfather-style disbursement charge", () => {
    const rows = getNoteCommercialTermRows(
      termNote({
        feeSchedule: {
          version: 1,
          facilityFeeCollectAmount: 800,
          additionalFees: [],
        },
        withdrawals: [
          {
            withdrawalType: "ISSUER_DISBURSEMENT",
            facilityFeeCharged: 1_250,
          },
        ] as NoteDetail["withdrawals"],
      })
    );
    expect(rows.find((row) => row.label === "Facility fee")?.value).toBe(
      "RM 800.00 at disbursement"
    );
  });

  it("shows waived facility collection and extra fee lines from the frozen schedule", () => {
    const rows = getNoteCommercialTermRows(
      termNote({
        facilityFeeCollectionWaiver: {
          version: 1,
          facilityFeeCollectionWaived: true,
          waivedAt: "2026-08-22T00:00:00.000Z",
          waivedByUserId: "admin",
          waivedReason: "Issuer request",
        },
        feeSchedule: {
          version: 1,
          facilityFeeCollectAmount: 800,
          additionalFees: [
            { name: "Legal", kind: "amount", value: 50 },
            { name: "Admin", kind: "percent_of_funded", value: 1 },
          ],
        },
      })
    );
    const byLabel = Object.fromEntries(rows.map((row) => [row.label, row.value]));
    expect(byLabel["Facility fee"]).toBe("Collection waived for this note");
    expect(byLabel["Legal"]).toBe("RM 50.00 at disbursement");
    expect(byLabel["Admin"]).toBe("1% of funds raised");
  });
});
