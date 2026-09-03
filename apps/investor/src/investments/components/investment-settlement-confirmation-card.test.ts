import { readFileSync } from "node:fs";
import { join } from "node:path";

const card = readFileSync(
  join(__dirname, "./investment-settlement-confirmation-card.tsx"),
  "utf8"
);
const page = readFileSync(join(__dirname, "../../app/investments/[id]/page.tsx"), "utf8");

describe("investor settlement confirmation UI", () => {
  it("keeps a compact document card with View and Download", () => {
    expect(card).toContain("Investment Settlement Confirmation");
    expect(card).toContain("confirmation.statusLabel");
    expect(card).toContain("confirmation.settlementDateDisplay");
    expect(card).toContain("View");
    expect(card).toContain("Download");
    expect(card).toContain('confirmation.status !== "READY"');
    expect(card).not.toContain("confirmation.principalReturned");
    expect(card).not.toContain("confirmation.introCopy");
    expect(card).not.toContain("View wallet");
    expect(card).not.toContain("Download confirmation");
    expect(card).not.toContain("confirmation.noteId");
    expect(card).not.toContain("investorOrganizationId");
    expect(card).not.toContain("settlementId");
    expect(card).not.toContain("walletTransactionIds");
    expect(card).not.toContain("CS-AR-2026-018");
    expect(card).not.toContain("ISS-2048");
    expect(card).not.toContain("RM 10,000.00");
  });

  it("does not keep the previous full inline confirmation stylesheet", () => {
    expect(card).not.toContain("investment-settlement-confirmation.module.css");
    expect(card).not.toContain("Download confirmation");
  });

  it("shows the compact card alongside the settlement breakdown when READY", () => {
    expect(page).toContain('confirmationQuery.data?.status === "READY"');
    expect(page).toContain("InvestmentSettlementConfirmationCard");
    expect(page).toContain("InvestmentReturnBreakdownCard");
    expect(page).toContain("hasSettledBreakdown");
    expect(page).toContain("useDownloadInvestorInvestmentSettlementConfirmation");
    expect(page).toContain("InvestmentReturnBreakdownCard");
  });
});
