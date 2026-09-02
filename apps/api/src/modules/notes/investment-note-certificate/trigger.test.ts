import { readFileSync } from "node:fs";
import { join } from "node:path";

const notesService = readFileSync(join(__dirname, "../service.ts"), "utf8");
const closeFundingIdx = notesService.indexOf("async closeFunding");
const markIdx = notesService.indexOf("async markWithdrawalCompleted");

describe("investment note certificate trigger sites", () => {
  it("schedules generation only after markWithdrawalCompleted issuer disbursement", () => {
    expect(notesService).toContain("scheduleInvestmentNoteCertificateGeneration");
    const markBlock = notesService.slice(markIdx);
    expect(markBlock).toContain("WithdrawalType.ISSUER_DISBURSEMENT");
    expect(markBlock).toContain("scheduleInvestmentNoteCertificateGeneration");
    expect(markBlock).toContain("DISBURSEMENT_COMPLETED");
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
