import { readFileSync } from "node:fs";
import { join } from "node:path";
import { INVESTMENT_SETTLEMENT_CONFIRMATION_PROCESSING_NOTICE } from "@cashsouk/types";

const card = readFileSync(
  join(__dirname, "./investment-settlement-confirmation-card.tsx"),
  "utf8"
);
const page = readFileSync(join(__dirname, "../../app/investments/[id]/page.tsx"), "utf8");
const css = readFileSync(
  join(__dirname, "./investment-settlement-confirmation.module.css"),
  "utf8"
);

describe("investor settlement confirmation UI", () => {
  it("uses system fields and the approved processing notice", () => {
    expect(card).toContain("confirmation.noteReference");
    expect(card).toContain("confirmation.issuerReference");
    expect(card).toContain("confirmation.settlementDateDisplay");
    expect(card).toContain("confirmation.principalReturned");
    expect(card).toContain("confirmation.serviceFeeLabel");
    expect(card).toContain("confirmation.showTawidh");
    expect(card).toContain("PORTFOLIO_TRANSACTIONS_HREF");
    expect(card).toContain("INVESTMENT_SETTLEMENT_CONFIRMATION_PROCESSING_NOTICE");
    expect(card).not.toContain("CS-AR-2026-018");
    expect(card).not.toContain("ISS-2048");
    expect(card).not.toContain("RM 10,000.00");
    expect(card).not.toContain("Your investment note has been fully settled.");
    expect(INVESTMENT_SETTLEMENT_CONFIRMATION_PROCESSING_NOTICE).toBe(
      "The credited amount may take 2–3 working days to be reflected in your available wallet balance."
    );
  });

  it("keeps the gold notice and action buttons on the web card", () => {
    expect(css).toContain("#efbd4f");
    expect(card).toContain("Download confirmation");
    expect(card).toContain("View wallet");
  });

  it("shows the confirmation instead of the duplicate breakdown only when READY", () => {
    expect(page).toContain('confirmationQuery.data?.status === "READY"');
    expect(page).toContain("InvestmentSettlementConfirmationCard");
    expect(page).toContain("InvestmentReturnBreakdownCard");
  });
});
