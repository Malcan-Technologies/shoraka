import { NOTIFICATION_TEMPLATES, NotificationTypeIds } from "./registry";

describe("notification coverage templates", () => {
  it("keeps application_amendments_requested as CashSouk requesting amendments", () => {
    const t = NOTIFICATION_TEMPLATES[NotificationTypeIds.APPLICATION_AMENDMENTS_REQUESTED];
    expect(t.title).toBe("Amendment Requested");
    expect(t.portal).toBe("issuer");
    expect(t.message({ applicationId: "a1", displayReference: "APP-9" })).toBe(
      "An amendment is required for application APP-9. Review the request and resubmit your application."
    );
  });

  it("renders APPLICATION_SUBMITTED_CONFIRMATION copy", () => {
    const t = NOTIFICATION_TEMPLATES[NotificationTypeIds.APPLICATION_SUBMITTED_CONFIRMATION];
    expect(t.title).toBe("Application Submitted");
    expect(t.message({ applicationId: "a1", displayReference: "APP-9" })).toBe(
      "Your application APP-9 has been submitted successfully and is now under review."
    );
    expect(t.portal).toBe("issuer");
  });

  it("renders signing-deadline copy with the formatted deadline", () => {
    const contract = NOTIFICATION_TEMPLATES[NotificationTypeIds.CONTRACT_SIGNING_DEADLINE_EXTENDED];
    expect(contract.title).toBe("Signing Deadline Extended");
    expect(
      contract.message({
        applicationId: "a1",
        displayReference: "APP-9",
        deadline: "2026-09-01T00:00:00.000Z",
      })
    ).toMatch(/The signing deadline for application APP-9 has been extended to /);

    const invoice = NOTIFICATION_TEMPLATES[NotificationTypeIds.INVOICE_SIGNING_DEADLINE_EXTENDED];
    expect(
      invoice.message({
        applicationId: "a1",
        displayReference: "APP-9",
        invoiceNumber: "INV-42",
        deadline: "2026-09-01T00:00:00.000Z",
      })
    ).toMatch(/The signing deadline for invoice INV-42 has been extended to /);
  });

  it("renders facility disabled copy", () => {
    const t = NOTIFICATION_TEMPLATES[NotificationTypeIds.FACILITY_DISABLED];
    expect(t.title).toBe("Facility Disabled");
    expect(t.message({ applicationId: "a1", displayReference: "APP-9" })).toBe(
      "Your facility for application APP-9 has been disabled. New drawdowns are currently unavailable."
    );
  });

  it("renders note payment rejected and disbursement completed copy", () => {
    const rejected = NOTIFICATION_TEMPLATES[NotificationTypeIds.NOTE_PAYMENT_REJECTED];
    expect(rejected.title).toBe("Repayment Rejected");
    expect(rejected.message({ noteId: "n1", noteTitle: "N-1" })).toBe(
      "Your repayment for note N-1 was rejected. Please review the repayment details."
    );
    expect(rejected.portal).toBe("issuer");

    const completed = NOTIFICATION_TEMPLATES[NotificationTypeIds.WITHDRAWAL_COMPLETED];
    expect(completed.title).toBe("Your Disbursement Is Complete");
    expect(completed.message({ noteId: "n1", noteTitle: "N-1" })).toBe(
      "The disbursement for note N-1 has been completed."
    );

    const investorActive = NOTIFICATION_TEMPLATES[NotificationTypeIds.NOTE_ACTIVE_INVESTOR];
    expect(investorActive.title).toBe("Investment is active");
    expect(investorActive.message({ noteId: "n1", noteTitle: "N-1" })).toBe(
      'Funding for "N-1" is complete and the note is now active. Monitor repayments from your investments view.'
    );
    expect(investorActive.portal).toBe("investor");
  });

  it("renders investor deposit copy", () => {
    const failed = NOTIFICATION_TEMPLATES[NotificationTypeIds.DEPOSIT_NAME_CHECK_REJECTED];
    expect(failed.title).toBe("Deposit Verification Failed");
    expect(failed.message({ amount: 100 })).toBe(
      "Your deposit could not be verified and will be returned."
    );
    expect(failed.portal).toBe("investor");

    const started = NOTIFICATION_TEMPLATES[NotificationTypeIds.DEPOSIT_REFUND_INITIATED];
    expect(started.message({ amount: 1500 })).toBe(
      "A refund for your deposit of RM1,500 has been initiated."
    );
    const done = NOTIFICATION_TEMPLATES[NotificationTypeIds.DEPOSIT_REFUNDED];
    expect(done.message({ amount: 1500 })).toBe("Your refund of RM1,500 has been completed.");
  });

  it("renders investor cash-withdrawal copy without trustee or instruction IDs", () => {
    const submitted = NOTIFICATION_TEMPLATES[NotificationTypeIds.INVESTOR_WITHDRAWAL_SUBMITTED];
    expect(submitted.title).toBe("Withdrawal Submitted");
    expect(submitted.message({ amount: 1500 })).toBe(
      "Your withdrawal request of RM1,500 has been submitted for processing."
    );
    expect(submitted.portal).toBe("investor");
    expect(submitted.message({ amount: 1500 }).toLowerCase()).not.toContain("trustee");

    const completed = NOTIFICATION_TEMPLATES[NotificationTypeIds.INVESTOR_WITHDRAWAL_COMPLETED];
    expect(completed.title).toBe("Withdrawal Completed");
    expect(completed.message({ amount: 1500 })).toBe(
      "Your withdrawal of RM1,500 has been completed."
    );
    expect(completed.portal).toBe("investor");
  });

  it("renders investment committed and successful deposit copy", () => {
    const committed = NOTIFICATION_TEMPLATES[NotificationTypeIds.INVESTMENT_COMMITTED];
    expect(committed.title).toBe("Investment Committed");
    expect(
      committed.message({ amount: 2500, noteId: "n1", noteTitle: "Invoice Note" })
    ).toBe('Your investment of RM2,500 in "Invoice Note" has been successfully committed.');
    expect(committed.portal).toBe("investor");

    const deposited = NOTIFICATION_TEMPLATES[NotificationTypeIds.DEPOSIT_SUCCESSFUL];
    expect(deposited.title).toBe("Deposit Successful");
    expect(deposited.message({ amount: 1500 })).toBe(
      "Your deposit of RM1,500 has been successfully credited to your wallet."
    );
    expect(deposited.portal).toBe("investor");
    expect(typeof deposited.linkPath === "function" ? deposited.linkPath({ amount: 1500 }) : deposited.linkPath).toBe(
      "/transactions"
    );
  });

  it("sets an explicit investor portal on NEW_PRODUCT_ALERT and leaves password/announcement unset", () => {
    const product = NOTIFICATION_TEMPLATES[NotificationTypeIds.NEW_PRODUCT_ALERT];
    expect(product.portal).toBe("investor");
    expect(
      typeof product.linkPath === "function"
        ? product.linkPath({ productName: "Note A", productId: "prod-1" })
        : product.linkPath
    ).toBe("/investments/prod-1");

    expect(NOTIFICATION_TEMPLATES[NotificationTypeIds.PASSWORD_CHANGED].portal).toBeUndefined();
    expect(NOTIFICATION_TEMPLATES[NotificationTypeIds.SYSTEM_ANNOUNCEMENT].portal).toBeUndefined();
  });

  it("renders withdrawal submitted-to-trustee copy with the display reference", () => {
    const t = NOTIFICATION_TEMPLATES[NotificationTypeIds.WITHDRAWAL_SUBMITTED_TO_TRUSTEE];
    expect(t.title).toBe("Withdrawal Submitted to Trustee");
    const payload = {
      withdrawalId: "clyk2n9x0001qwertyuiop",
      noteId: "note-1",
      noteTitle: "Note One",
      displayReference: "WDL-ARF-202608-A1Z",
      withdrawalType: "ISSUER_DISBURSEMENT",
      portalType: "issuer" as const,
    };
    expect(t.message(payload)).toBe(
      'Withdrawal instruction WDL-ARF-202608-A1Z for "Note One" (ISSUER_DISBURSEMENT) has been submitted to the trustee.'
    );
    expect(t.message(payload)).not.toContain("clyk2n9x0001qwertyuiop");
    expect(typeof t.linkPath === "function" ? t.linkPath(payload) : t.linkPath).toBe(
      "/financing/notes/note-1"
    );
  });
});
