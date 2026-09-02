import { readFileSync } from "node:fs";
import { join } from "node:path";

const notesService = readFileSync(join(__dirname, "../service.ts"), "utf8");
const closeFundingIdx = notesService.indexOf("async closeFunding");
const markIdx = notesService.indexOf("async markWithdrawalCompleted");
const controller = readFileSync(join(__dirname, "../controller.ts"), "utf8");

describe("investment note certificate trigger sites", () => {
  it("does not schedule generation after markWithdrawalCompleted", () => {
    expect(notesService).not.toContain("scheduleInvestmentNoteCertificateGeneration");
    const markBlock = notesService.slice(markIdx);
    expect(markBlock).toContain("WithdrawalType.ISSUER_DISBURSEMENT");
    expect(markBlock).not.toContain("scheduleInvestmentNoteCertificateGeneration");
    expect(markBlock).not.toContain("DISBURSEMENT_COMPLETED");
  });

  it("does not schedule from closeFunding", () => {
    const closeBlock = notesService.slice(closeFundingIdx, markIdx);
    expect(closeBlock).not.toContain("scheduleInvestmentNoteCertificateGeneration");
  });

  it("does not schedule from Shoraka certificate fetch", () => {
    const shoraka = readFileSync(
      join(__dirname, "../../shoraka-stp/shoraka-stp-service.ts"),
      "utf8"
    );
    expect(shoraka).not.toContain("scheduleInvestmentNoteCertificateGeneration");
    expect(shoraka).not.toContain("investment-note-certificate");
  });
});

describe("investment note certificate admin generate and version routes", () => {
  it("exposes Admin generate, retry, reissue and publish with disbursement permission", () => {
    expect(controller).toContain('"/:id/investment-note-certificate/generate"');
    expect(controller).toContain('"/:id/investment-note-certificate/retry"');
    expect(controller).toContain('"/:id/investment-note-certificate/reissue"');
    expect(controller).toContain('"/:id/investment-note-certificate/publish"');
    for (const route of ["generate", "retry", "reissue", "publish"] as const) {
      const idx = controller.indexOf(`"/:id/investment-note-certificate/${route}"`);
      const block = controller.slice(idx - 120, idx + 400);
      expect(block).toContain('requirePermission("notes.disbursement.manage")');
    }
    const investorStart = controller.indexOf("investorNotesRouter.use");
    const issuerStart = controller.indexOf("issuerNotesRouter.use");
    expect(controller.slice(investorStart, issuerStart)).not.toContain("/reissue");
    expect(controller.slice(issuerStart)).not.toContain("investment-note-certificate/reissue");
  });
});
