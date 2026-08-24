import * as fs from "fs";
import * as path from "path";
import { validateFinancingTenureAgainstDueDate } from "@cashsouk/types";

describe("admin invoice offer tenure", () => {
  const source = fs.readFileSync(path.join(__dirname, "invoice-offer-panel.tsx"), "utf8");

  it("blocks send using the shared due-date helper message, not only the min-month guard", () => {
    expect(source).toContain("validateFinancingTenureAgainstDueDate");
    expect(source).toContain("sendOfferBlockedByTenure");
    expect(source).toContain("tenureValidation.message");
    expect(source).toContain("sendOfferBlockedByMaturity");
    expect(source.indexOf("sendOfferBlockedByTenure")).toBeLessThan(
      source.indexOf("sendOfferBlockedByMaturity")
    );
  });

  it("propagates a past due-date error from the shared helper", () => {
    expect(
      validateFinancingTenureAgainstDueDate({
        tenureDays: 30,
        maturityDate: "2026-08-23",
        referenceDate: new Date("2026-08-24T02:00:00.000Z"),
      })
    ).toEqual({
      ok: false,
      message: "Invoice due date cannot be in the past.",
    });
  });
});
