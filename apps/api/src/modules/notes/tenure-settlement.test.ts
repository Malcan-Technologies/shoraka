import { AppError } from "../../lib/http/error-handler";
import {
  assertTenureInvestorObligationCovered,
  assertTenurePartialReceiptAllowed,
  classifyTenureClearedDate,
  latestIncludedReceiptDate,
  resolveTenureClearedDate,
} from "./tenure-settlement";

describe("tenure settlement date and receipt rules", () => {
  const startDate = new Date("2026-01-01T00:00:00.000Z");
  const maturityDate = new Date("2026-04-01T00:00:00.000Z");
  const now = new Date("2026-08-23T16:00:00.000Z");

  it("rejects future, before-disbursement, and before-receipt cleared dates", () => {
    expect(() =>
      resolveTenureClearedDate({
        actualSettlementDate: "2026-08-25",
        now,
        disbursementDate: startDate,
      })
    ).toThrow(AppError);
    expect(() =>
      resolveTenureClearedDate({
        actualSettlementDate: "2025-12-31",
        now,
        disbursementDate: startDate,
      })
    ).toThrow(/cannot be before the disbursement date/);
    expect(() =>
      resolveTenureClearedDate({
        actualSettlementDate: "2026-03-01",
        now,
        disbursementDate: startDate,
        latestIncludedReceiptDate: new Date("2026-03-02T00:00:00.000Z"),
      })
    ).toThrow(/cannot be earlier than the latest included receipt/);
  });

  it("treats maturity+7 as grace and the next Malaysia day as late", () => {
    expect(
      classifyTenureClearedDate({
        startDate,
        maturityDate,
        clearedDate: new Date("2026-04-08T00:00:00.000Z"),
        graceDays: 7,
      })
    ).toBe("GRACE");
    expect(
      classifyTenureClearedDate({
        startDate,
        maturityDate,
        clearedDate: new Date("2026-04-09T00:00:00.000Z"),
        graceDays: 7,
      })
    ).toBe("LATE");
  });

  it("rejects partial receipts before or within grace and allows them after grace", () => {
    expect(() =>
      assertTenurePartialReceiptAllowed({
        classification: "GRACE",
        openReceiptAmount: 50_000,
        invoiceSettlementAmount: 100_000,
      })
    ).toThrow(/full invoice settlement amount/);
    expect(() =>
      assertTenurePartialReceiptAllowed({
        classification: "LATE",
        openReceiptAmount: 50_000,
        invoiceSettlementAmount: 100_000,
      })
    ).not.toThrow();
  });

  it("blocks final settlement when investor principal or profit remain unpaid", () => {
    expect(() =>
      assertTenureInvestorObligationCovered({
        classification: "LATE",
        investorObligationCovered: false,
      })
    ).toThrow(/principal and accrued profit/);
  });

  it("uses the latest included receipt calendar date", () => {
    const latest = latestIncludedReceiptDate([
      { receipt_date: new Date("2026-03-01T00:00:00.000Z") },
      { receipt_date: new Date("2026-04-09T00:00:00.000Z") },
    ]);
    expect(latest?.toISOString().startsWith("2026-04-09")).toBe(true);
  });
});
