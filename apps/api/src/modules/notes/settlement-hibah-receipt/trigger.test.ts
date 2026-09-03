import { readFileSync } from "node:fs";
import { join } from "node:path";

const notesService = readFileSync(join(__dirname, "../service.ts"), "utf8");
const controller = readFileSync(join(__dirname, "../controller.ts"), "utf8");
const hibahService = readFileSync(join(__dirname, "./service.ts"), "utf8");

const recordIdx = notesService.indexOf("async recordPayment");
const previewIdx = notesService.indexOf("async previewSettlement");
const approveIdx = notesService.indexOf("async approveSettlement");
const postIdx = notesService.indexOf("async postSettlement");
const trusteeIdx = notesService.indexOf("async markSettlementTrusteeInstructionCompleted");
const markIdx = notesService.indexOf("async markWithdrawalCompleted");

describe("settlement hibah receipt trigger sites", () => {
  it("does not schedule after postSettlement", () => {
    const postBlock = notesService.slice(postIdx, trusteeIdx);
    expect(postBlock).not.toContain("scheduleSettlementHibahReceiptGeneration");
    expect(postBlock).toContain("if (!needsTrusteeInstruction)");
  });

  it("does not schedule after trustee completion", () => {
    const trusteeBlock = notesService.slice(trusteeIdx, markIdx);
    expect(trusteeBlock).not.toContain("scheduleSettlementHibahReceiptGeneration");
    expect(trusteeBlock).toContain("if (noteMarkedRepaid)");
  });

  it("does not schedule after legacy issuer residual completion", () => {
    const markBlock = notesService.slice(markIdx);
    expect(markBlock).toContain("WithdrawalType.ISSUER_RESIDUAL_RETURN");
    expect(markBlock).toContain("noteReleasedFromLegacyResidual");
    expect(markBlock).not.toContain("scheduleSettlementHibahReceiptGeneration");
  });

  it("does not schedule from payment submit, preview, or approve", () => {
    expect(notesService.slice(recordIdx, previewIdx)).not.toContain(
      "scheduleSettlementHibahReceiptGeneration"
    );
    expect(notesService.slice(previewIdx, approveIdx)).not.toContain(
      "scheduleSettlementHibahReceiptGeneration"
    );
    expect(notesService.slice(approveIdx, postIdx)).not.toContain(
      "scheduleSettlementHibahReceiptGeneration"
    );
  });

  it("does not add an investor route", () => {
    const investorStart = controller.indexOf("investorNotesRouter.use");
    const issuerStart = controller.indexOf("issuerNotesRouter.use");
    const investorBlock = controller.slice(investorStart, issuerStart);
    expect(investorBlock).not.toContain("settlement-hibah-receipt");
    expect(controller).toContain('requirePermission("notes.view")');
    expect(controller).toContain('requirePermission("notes.settlement.manage")');
    expect(controller).toContain('"/:id/settlement-hibah-receipt"');
    expect(controller).toContain('"/notes/:id/settlement-hibah-receipt"');
  });

  it("exposes Admin generate, retry, reissue and publish with settlement permission", () => {
    expect(controller).toContain('"/:id/settlement-hibah-receipt/generate"');
    expect(controller).toContain('"/:id/settlement-hibah-receipt/reissue"');
    expect(controller).toContain('"/:id/settlement-hibah-receipt/publish"');
    for (const route of ["generate", "retry", "reissue", "publish"] as const) {
      const idx = controller.indexOf(`"/:id/settlement-hibah-receipt/${route}"`);
      const block = controller.slice(idx - 120, idx + 400);
      expect(block).toContain('requirePermission("notes.settlement.manage")');
    }
    const investorStart = controller.indexOf("investorNotesRouter.use");
    const issuerStart = controller.indexOf("issuerNotesRouter.use");
    expect(controller.slice(investorStart, issuerStart)).not.toContain("hibah-receipt/reissue");
    expect(controller.slice(issuerStart)).not.toContain("settlement-hibah-receipt/reissue");
  });

  it("converts via LibreOffice DOCX and never uses Chromium HTML or Playwright", () => {
    expect(hibahService).toContain('from "../../../lib/gotenberg/convert-docx-to-pdf"');
    expect(hibahService).toContain("renderSettlementHibahReceiptDocx");
    expect(hibahService).not.toContain("convert-html-to-pdf");
    expect(hibahService).not.toContain("playwright");
  });

  it("does not mutate notes, wallets, or settlement math from the receipt module", () => {
    expect(hibahService).not.toContain("note.update");
    expect(hibahService).not.toContain("noteSettlement.update");
    expect(hibahService).not.toContain("investorBalance");
    expect(hibahService).not.toContain("calculateCeilingAwareGrossProfit");
    const snapshot = readFileSync(join(__dirname, "./snapshot.ts"), "utf8");
    expect(snapshot).not.toContain("calculateCeilingAwareGrossProfit");
    const notifications = readFileSync(
      join(__dirname, "../../notification/note-lifecycle-notifications.ts"),
      "utf8"
    );
    expect(notifications).not.toContain("SETTLEMENT_HIBAH");
    expect(notifications).not.toContain("scheduleSettlementHibahReceiptGeneration");
  });
});
