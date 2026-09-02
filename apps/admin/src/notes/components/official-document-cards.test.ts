import { readFileSync } from "node:fs";
import { join } from "node:path";

function source(relative: string): string {
  return readFileSync(join(__dirname, relative), "utf8");
}

describe("admin official document cards", () => {
  it("shows Generate, Retry, View, Download, Regenerate and Publish for certificates", () => {
    const card = source("../components/investment-note-certificate-card.tsx");
    expect(card).toContain("Islamic Investment Note Certificate");
    expect(card).toContain("Generate Certificate");
    expect(card).toContain("Retry");
    expect(card).toContain("View");
    expect(card).toContain("Download");
    expect(card).toContain("Regenerate");
    expect(card).toContain("Publish New Version");
    expect(card).toContain("Ready for review");
    expect(card).toContain("Version {payload.version}");
    expect(card).toContain("useReissueAdminInvestmentNoteCertificate");
    expect(card).toContain("useGenerateAdminInvestmentNoteCertificate");
    expect(card).toContain("usePublishAdminInvestmentNoteCertificate");
    expect(card).not.toContain("Regenerate / Reissue");
  });

  it("shows Generate, Retry, View, Download, Regenerate and Publish for receipts", () => {
    const card = source("../components/settlement-hibah-receipt-card.tsx");
    expect(card).toContain("Generate Receipt");
    expect(card).toContain("Retry");
    expect(card).toContain("View");
    expect(card).toContain("Download");
    expect(card).toContain("Regenerate");
    expect(card).toContain("Publish New Version");
    expect(card).toContain("useReissueAdminSettlementHibahReceipt");
    expect(card).toContain("useGenerateAdminSettlementHibahReceipt");
    expect(card).not.toContain("Regenerate / Reissue");
  });

  it("shows per-investor Generate, Generate All, Retry, Regenerate and Publish for confirmations", () => {
    const card = source("../components/investment-settlement-confirmation-card.tsx");
    expect(card).toContain("Investment Settlement Confirmations");
    expect(card).toContain("Generate All");
    expect(card).toContain("Generate");
    expect(card).toContain("Retry");
    expect(card).toContain("Regenerate");
    expect(card).toContain("Publish New Version");
    expect(card).toContain("Not generated");
    expect(card).not.toContain("Regenerate / Reissue");
  });
});
