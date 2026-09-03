import { readFileSync } from "node:fs";
import { join } from "node:path";

const notesService = readFileSync(join(__dirname, "../service.ts"), "utf8");
const controller = readFileSync(join(__dirname, "../controller.ts"), "utf8");
const confirmationService = readFileSync(join(__dirname, "./service.ts"), "utf8");
const confirmationHtml = readFileSync(join(__dirname, "./confirmation-html.ts"), "utf8");
const snapshot = readFileSync(join(__dirname, "./snapshot.ts"), "utf8");
const notifications = readFileSync(
  join(__dirname, "../../notification/note-lifecycle-notifications.ts"),
  "utf8"
);
const registry = readFileSync(join(__dirname, "../../notification/registry.ts"), "utf8");

const recordIdx = notesService.indexOf("async recordPayment");
const previewIdx = notesService.indexOf("async previewSettlement");
const approveIdx = notesService.indexOf("async approveSettlement");
const postIdx = notesService.indexOf("async postSettlement");
const trusteeIdx = notesService.indexOf("async markSettlementTrusteeInstructionCompleted");

describe("investment settlement confirmation trigger sites", () => {
  it("does not schedule after postSettlement", () => {
    const postBlock = notesService.slice(postIdx, trusteeIdx);
    expect(postBlock).not.toContain("scheduleInvestmentSettlementConfirmations");
    expect(postBlock).toContain("notifyNoteSettlementPosted");
  });

  it("does not schedule from payment submit, preview, or approve", () => {
    expect(notesService.slice(recordIdx, previewIdx)).not.toContain(
      "scheduleInvestmentSettlementConfirmations"
    );
    expect(notesService.slice(previewIdx, approveIdx)).not.toContain(
      "scheduleInvestmentSettlementConfirmations"
    );
    expect(notesService.slice(approveIdx, postIdx)).not.toContain(
      "scheduleInvestmentSettlementConfirmations"
    );
  });

  it("exposes investor and admin routes and no issuer route", () => {
    expect(controller).toContain('"/investments/:investmentId/settlement-confirmation"');
    expect(controller).toContain('"/:id/investment-settlement-confirmations"');
    expect(controller).toContain('"/:id/investment-settlement-confirmations/generate"');
    expect(controller).toContain(
      '"/:id/investment-settlement-confirmations/:investorOrganizationId/generate"'
    );
    expect(controller).toContain(
      '"/:id/investment-settlement-confirmations/:investorOrganizationId/publish"'
    );
    expect(controller).not.toContain("issuerNotesRouter.get(\"/notes/:id/investment-settlement-confirmation");
  });

  it("reuses the Prospectus Playwright HTML helper and never converts DOCX or Gotenberg HTML", () => {
    expect(confirmationService).toContain("renderConfirmationHtmlToPdfBuffer");
    expect(confirmationService).toContain("./render-confirmation-html-to-pdf");
    expect(confirmationService).not.toContain("convert-html-to-pdf");
    expect(confirmationService).not.toContain("convertHtmlToPdf");
    expect(confirmationService).not.toContain("convert-docx-to-pdf");
    expect(confirmationHtml).not.toContain("playwright");
    expect(confirmationHtml).not.toContain("gotenberg");
  });

  it("does not mutate notes, wallets, settlement math, or notifications", () => {
    expect(confirmationService).not.toContain("note.update");
    expect(confirmationService).not.toContain("noteSettlement.update");
    expect(confirmationService).not.toContain("investorBalance.update");
    expect(confirmationService).not.toContain("calculateCeilingAwareGrossProfit");
    expect(notifications).not.toContain("scheduleInvestmentSettlementConfirmations");
    expect(notifications).not.toContain("INVESTMENT_SETTLEMENT_CONFIRMATION");
    expect(registry).toContain("NOTE_SETTLEMENT_POSTED");
  });

  it("keeps wallet payout eligibility and does not add trustee status", () => {
    expect(snapshot).toContain("NOTE_INVESTMENT_RELEASE");
    expect(snapshot).toContain("SETTLEMENT_PAYOUT");
    expect(snapshot).toContain("certificatePartyDisplayReference");
    expect(snapshot).not.toContain("trustee");
    expect(confirmationService).not.toContain("trustee");
  });
});
