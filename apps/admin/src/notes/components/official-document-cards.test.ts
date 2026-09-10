import { readFileSync } from "node:fs";
import { join } from "node:path";

function source(relative: string): string {
  return readFileSync(join(__dirname, relative), "utf8");
}

describe("admin official document cards", () => {
  it("shows Generate, Retry, View, Download, Reissue and Publish for certificates", () => {
    const card = source("../components/investment-note-certificate-card.tsx");
    expect(card).toContain("Islamic Investment Note Certificate");
    expect(card).toContain("Islamic Investment Note Certificate generated");
    expect(card).toContain("Generate Certificate");
    expect(card).toContain("Retry");
    expect(card).toContain("View");
    expect(card).toContain("Download");
    expect(card).toContain("Reissue");
    expect(card).toContain("Publish New Version");
    expect(card).toContain("payload.version");
    expect(card).toContain("useReissueAdminInvestmentNoteCertificate");
    expect(card).toContain("useGenerateAdminInvestmentNoteCertificate");
    expect(card).toContain("usePublishAdminInvestmentNoteCertificate");
    expect(card).toContain("DocumentSigningPersonFields");
    expect(card).toContain("Shoraka signing person");
    expect(card).toContain("OfficialDocumentWorkflowPanel");
    expect(card).toContain("workflowTaskSurfaceClass");
    expect(card).toContain("officialDocumentWorkflowLabel");
    expect(card).not.toContain("Document Authorisation");
    expect(card).not.toContain("Regenerate / Reissue");
    expect(card).not.toMatch(/["']Regenerate["']/);
    expect(card).not.toContain("Ready for review");
  });

  it("shows Generate, Retry, View, Download, Reissue and Publish for receipts", () => {
    const card = source("../components/settlement-hibah-receipt-card.tsx");
    expect(card).toContain("Generate Receipt");
    expect(card).toContain("Retry");
    expect(card).toContain("View");
    expect(card).toContain("Download");
    expect(card).toContain("Reissue");
    expect(card).toContain("Publish New Version");
    expect(card).toContain("useReissueAdminSettlementHibahReceipt");
    expect(card).toContain("useGenerateAdminSettlementHibahReceipt");
    expect(card).toContain("DocumentSigningPersonFields");
    expect(card).toContain("Shoraka signing person");
    expect(card).toContain("OfficialDocumentWorkflowPanel");
    expect(card).not.toContain("Document Authorisation");
    expect(card).not.toContain("Regenerate / Reissue");
    expect(card).not.toMatch(/["']Regenerate["']/);
  });

  it("shows per-investor Generate, Generate All, Retry, Reissue and Publish for confirmations", () => {
    const card = source("../components/investment-settlement-confirmation-card.tsx");
    expect(card).toContain("Investment Settlement Confirmations");
    expect(card).toContain("Generate All");
    expect(card).toContain("Generate");
    expect(card).toContain("Retry");
    expect(card).toContain("Reissue");
    expect(card).toContain("Publish New Version");
    expect(card).toContain("Not generated");
    expect(card).toContain("OfficialDocumentWorkflowPanel");
    expect(card).not.toContain("Regenerate / Reissue");
    expect(card).not.toMatch(/["']Regenerate["']/);
  });

  it("washes the whole document panel with the workflow state colour", () => {
    const panel = source("./official-document-workflow-panel.tsx");
    expect(panel).toContain("workflowTaskSurfaceClass(tone)");
    expect(panel).toContain("Version {version}");
    expect(panel).toContain("justify-end gap-2 border-t");
  });

  it("places servicing documents after trustee instruction", () => {
    const panel = source("../components/settlement-panel.tsx");
    const trustee = panel.indexOf("completeLabel=\"3. Trustee instruction complete\"");
    const confirmations = panel.indexOf("<InvestmentSettlementConfirmationCard");
    const receipt = panel.indexOf("<SettlementHibahReceiptCard");
    expect(trustee).toBeGreaterThan(-1);
    expect(confirmations).toBeGreaterThan(trustee);
    expect(receipt).toBeGreaterThan(confirmations);
  });

  it("keeps the disbursement certificate after trustee payout, not before", () => {
    const page = source("../../app/notes/[id]/page.tsx");
    const payout = page.indexOf("<IssuerPayoutCard");
    const certificate = page.indexOf("<InvestmentNoteCertificateCard");
    expect(payout).toBeGreaterThan(-1);
    expect(certificate).toBeGreaterThan(payout);
    expect(page).toContain("disbursementWithdrawal.status !== \"CANCELLED\"");
    expect(page).not.toContain("investmentNoteCertificate.canGenerate ||");
  });
});

describe("admin document signing person fields", () => {
  it("selects a configured Shoraka person and shows read-only signature and stamp previews", () => {
    const fields = source("./document-signing-person-fields.tsx");
    expect(fields).toContain("Signing person *");
    expect(fields).toContain("Select signing person");
    expect(fields).toContain("person.label");
    expect(fields).toContain("Signature");
    expect(fields).toContain("Company Stamp");
    expect(fields).toContain("Shoraka Profile → Signing & Authorisation");
    expect(fields).toContain("SHORAKA_SIGNING_PERSON_NO_SIGNATURE_MESSAGE");
    expect(fields).toContain("defaultDocumentSigningPersonId");
    expect(fields).not.toContain("type=\"file\"");
    expect(fields).not.toContain("authorisedSignatoryName");
  });
});
