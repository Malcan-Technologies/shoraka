import * as fs from "fs";
import * as path from "path";

describe("admin trustee letter auto-email UI wiring", () => {
  it("loads and saves auto-send without coercing undefined to true", () => {
    const settings = fs.readFileSync(
      path.join(__dirname, "../app/settings/platform-finance/page.tsx"),
      "utf8"
    );
    expect(settings).toContain("autoSendTrusteeEmail: false");
    expect(settings).toContain("data.trusteeLetterConfig?.autoSendTrusteeEmail === true");
    expect(settings).toContain("buildTrusteeLetterConfigPayload");
    expect(settings).toContain("TrusteeLetterEmailFields");
    expect(settings).toContain("trusteeLetterSaveDisabled");
    expect(settings).toContain('import { notesKeys } from "@/notes/query-keys"');
    expect(settings).toContain('queryKey: notesKeys.all');
  });

  it("shows delivered metadata on each mark-submitted surface", () => {
    const issuerPayout = fs.readFileSync(
      path.join(__dirname, "../notes/components/issuer-payout-card.tsx"),
      "utf8"
    );
    const settlement = fs.readFileSync(
      path.join(__dirname, "../notes/components/settlement-panel.tsx"),
      "utf8"
    );
    const investorWithdrawal = fs.readFileSync(
      path.join(__dirname, "../app/finance/investor-withdrawals/[id]/page.tsx"),
      "utf8"
    );
    expect(issuerPayout).toContain("formatTrusteeInstructionEmailedCopy");
    expect(issuerPayout).toContain("withdrawal.trusteeEmailSentAt");
    expect(issuerPayout).toContain("getTrusteeSubmitCopy");
    expect(issuerPayout).toContain("getTrusteeResendCopy");
    expect(issuerPayout).toContain("canResendWithdrawalTrusteeEmail");
    expect(issuerPayout).toContain("useResendWithdrawalTrusteeEmail");
    expect(issuerPayout).toContain("note.trusteeAutoSendEmailEnabled === true");
    expect(issuerPayout).toContain("TRUSTEE_EMAIL_DELIVERED_LABEL");
    expect(settlement).toContain("settlementTrusteeEmailSentAt");
    expect(settlement).toContain("formatTrusteeInstructionEmailedCopy");
    expect(settlement).toContain("getTrusteeSubmitCopy");
    expect(settlement).toContain("getTrusteeResendCopy");
    expect(settlement).toContain("canResendSettlementTrusteeEmail");
    expect(settlement).toContain("useResendSettlementTrusteeEmail");
    expect(settlement).toContain("note.trusteeAutoSendEmailEnabled === true");
    expect(settlement).toContain("TRUSTEE_EMAIL_DELIVERED_LABEL");
    expect(investorWithdrawal).toContain("trusteeEmailSentAt");
    expect(investorWithdrawal).toContain("formatTrusteeInstructionEmailedCopy");
    expect(investorWithdrawal).toContain("getTrusteeSubmitCopy");
    expect(investorWithdrawal).toContain("getTrusteeResendCopy");
    expect(investorWithdrawal).toContain("canResendWithdrawalTrusteeEmail");
    expect(investorWithdrawal).toContain("useResendWithdrawalTrusteeEmail");
    expect(investorWithdrawal).toContain("withdrawal?.trusteeAutoSendEmailEnabled === true");
    expect(investorWithdrawal).toContain("TRUSTEE_EMAIL_DELIVERED_LABEL");
    expect(investorWithdrawal).toContain("AlertDialog");
    expect(investorWithdrawal).toContain("trusteeSubmitCopy.confirmTitle");
    expect(investorWithdrawal).toContain("trusteeSubmitCopy.description");
    expect(investorWithdrawal).toContain("trusteeSubmitCopy.confirmLabel");
    expect(investorWithdrawal).toContain("setSubmitConfirmOpen(true)");
    expect(investorWithdrawal).toContain("event.preventDefault()");
    expect(investorWithdrawal).toContain("void confirmSubmitToTrustee()");
  });
});
