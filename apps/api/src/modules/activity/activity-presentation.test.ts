import {
  ADMIN_NOTE_OPERATIONAL_EVENT_TYPES,
  formatApplicationActivity,
  formatNoteActivity,
  formatOnboardingActivity,
  formatPaymentActivity,
  formatSigningActivity,
} from "@cashsouk/types";

function expectSafeCopy(title: string, description: string) {
  expect(title).toBeTruthy();
  expect(description).toBeTruthy();
  expect(title).not.toMatch(/undefined|null/i);
  expect(description).not.toMatch(/undefined|null/i);
  expect(title).not.toMatch(/[{}]/);
  expect(description).not.toMatch(/[{}]/);
}

describe("Activity presentation copy", () => {
  describe("onboarding", () => {
    it("keeps ONBOARDING_APPROVED from implying onboarding is complete", () => {
      const issuer = formatOnboardingActivity("issuer", "ONBOARDING_APPROVED");
      const investor = formatOnboardingActivity("investor", "ONBOARDING_APPROVED");
      const admin = formatOnboardingActivity("admin", "ONBOARDING_APPROVED", {
        actorName: "Aisha",
      });

      expect(issuer).toEqual({
        title: "Onboarding Submission Approved",
        description:
          "Your onboarding submission was approved. Additional checks may still be required before onboarding is completed.",
      });
      expect(investor).toEqual(issuer);
      expect(admin.title).toBe("Onboarding Approved");
      expect(admin.description).toBe("Aisha approved the onboarding submission.");
      expect(issuer.description.toLowerCase()).not.toMatch(
        /no further action|onboarding is complete\.|was marked completed/
      );
    });

    it("keeps ONBOARDING_COMPLETED as a distinct final milestone", () => {
      const completed = formatOnboardingActivity("issuer", "ONBOARDING_COMPLETED");
      const approved = formatOnboardingActivity("issuer", "ONBOARDING_APPROVED");

      expect(completed.title).toBe("Onboarding Completed");
      expect(completed.description).toBe("Your organization onboarding is complete.");
      expect(completed.title).not.toBe(approved.title);
      expect(completed.description).not.toBe(approved.description);
    });

    it("does not expose reasonCode on rejection", () => {
      const rejected = formatOnboardingActivity("issuer", "ONBOARDING_REJECTED", {
        reasonCode: "MISSING_DOCUMENTS",
      });
      expect(rejected.title).toBe("Onboarding Rejected");
      expect(rejected.description).toBe("Your organization onboarding was rejected.");
      expect(rejected.description).not.toContain("MISSING_DOCUMENTS");
      expect(rejected.description).not.toContain("reasonCode");
    });

    it("maps director KYC to the three visible states", () => {
      expect(
        formatOnboardingActivity("issuer", "DIRECTOR_KYC_STATUS_UPDATED", {
          newKycStatus: "APPROVED",
        }).title
      ).toBe("Director Verification Approved");
      expect(
        formatOnboardingActivity("issuer", "DIRECTOR_KYC_STATUS_UPDATED", {
          newKycStatus: "REJECTED",
        }).title
      ).toBe("Director Verification Rejected");
      expect(
        formatOnboardingActivity("issuer", "DIRECTOR_KYC_STATUS_UPDATED", {
          newKycStatus: "ACTION_REQUIRED",
        }).title
      ).toBe("Director Verification Action Needed");
      expect(
        formatOnboardingActivity("issuer", "DIRECTOR_KYC_STATUS_UPDATED", {
          newKycStatus: "WAIT_FOR_APPROVAL",
        }).description
      ).not.toContain("WAIT_FOR_APPROVAL");
    });

    it("maps review and amendment STATUS_CHANGED transitions without raw triggers", () => {
      const submittedSsm = formatOnboardingActivity("issuer", "ONBOARDING_STATUS_CHANGED", {
        previousStatus: "IN_PROGRESS",
        newStatus: "PENDING_SSM_REVIEW",
        trigger: "COD_WAIT_FOR_APPROVAL",
      });
      expect(submittedSsm).toEqual({
        title: "Verification Submitted",
        description: "The organisation was submitted for company verification review.",
      });

      const submittedApproval = formatOnboardingActivity("investor", "ONBOARDING_STATUS_CHANGED", {
        previousStatus: "PENDING",
        newStatus: "PENDING_APPROVAL",
        trigger: "LIVENESS_PASSED",
      });
      expect(submittedApproval).toEqual({
        title: "Verification Submitted",
        description: "The organisation was submitted for onboarding review.",
      });

      const amendment = formatOnboardingActivity("admin", "ONBOARDING_STATUS_CHANGED", {
        previousStatus: "PENDING_SSM_REVIEW",
        newStatus: "PENDING_AMENDMENT",
        trigger: "URL_GENERATED",
      });
      expect(amendment).toEqual({
        title: "Amendment Requested",
        description: "The organisation was sent back to update verification details.",
      });

      const resubmitted = formatOnboardingActivity("issuer", "ONBOARDING_STATUS_CHANGED", {
        previousStatus: "PENDING_AMENDMENT",
        newStatus: "PENDING_SSM_REVIEW",
        trigger: "COD_WAIT_FOR_APPROVAL",
      });
      expect(resubmitted).toEqual({
        title: "Verification Resubmitted",
        description: "Updated verification was submitted and review resumed.",
      });

      for (const copy of [submittedSsm, submittedApproval, amendment, resubmitted]) {
        expect(copy.title + copy.description).not.toMatch(
          /COD_WAIT_FOR_APPROVAL|URL_GENERATED|LIVENESS_PASSED|REGTANK_APPROVED/
        );
      }
    });

    it("falls back to a humanized stage update for unexpected STATUS_CHANGED transitions", () => {
      const fallback = formatOnboardingActivity("admin", "ONBOARDING_STATUS_CHANGED", {
        previousStatus: "PENDING_APPROVAL",
        newStatus: "PENDING_AML",
        trigger: "REGTANK_APPROVED",
      });
      expect(fallback.title).toBe("Onboarding Stage Updated");
      expect(fallback.description).toBe(
        "Onboarding moved from Pending Approval to Pending AML."
      );
      expect(fallback.description).not.toContain("REGTANK_APPROVED");
    });

    it("renders historical retired onboarding events safely", () => {
      const resumed = formatOnboardingActivity("admin", "ONBOARDING_RESUMED", {
        requestId: "req_1",
      });
      expect(resumed.title).toBe("Onboarding Resumed");
      expectSafeCopy(resumed.title, resumed.description);
      expect(resumed.description).not.toContain("req_1");

      const entities = formatOnboardingActivity("admin", "CORPORATE_ENTITIES_UPDATED", {
        addedCount: 1,
      });
      expect(entities.title).toBe("Corporate Entities Updated");
      expectSafeCopy(entities.title, entities.description);

      const ctos = formatOnboardingActivity("admin", "CTOS_REPORT_RECEIVED", {
        reportId: "ctos_1",
        entityType: "company",
        provider: "CTOS",
      });
      expect(ctos.title).toBe("CTOS Report Received");
      expectSafeCopy(ctos.title, ctos.description);
      expect(ctos.description).not.toContain("ctos_1");
    });

    it("shows director email to admin only", () => {
      const admin = formatOnboardingActivity("admin", "DIRECTOR_ONBOARDING_INVITATION_SENT", {
        directorEmail: "director@example.com",
      });
      const issuer = formatOnboardingActivity("issuer", "DIRECTOR_ONBOARDING_INVITATION_SENT", {
        directorEmail: "director@example.com",
      });
      expect(admin.description).toContain("director@example.com");
      expect(issuer.description).toBe("A director was invited to complete verification.");
      expect(issuer.description).not.toContain("director@example.com");
    });
  });

  describe("application", () => {
    it("uses Application Created and does not say Application Started", () => {
      const created = formatApplicationActivity("issuer", "APPLICATION_CREATED");
      expect(created.title).toBe("Application Created");
      expect(created.title).not.toMatch(/Started/i);
    });

    it("does not say Application Submitted is now under review", () => {
      const submitted = formatApplicationActivity("issuer", "APPLICATION_SUBMITTED");
      expect(submitted.title).toBe("Application Submitted");
      expect(submitted.description.toLowerCase()).not.toContain("now under review");
      expect(submitted.description).toBe("Your application has been submitted for review.");
    });

    it("labels withdrawal as Withdrawn, not Closed", () => {
      const withdrawn = formatApplicationActivity("issuer", "APPLICATION_WITHDRAWN");
      expect(withdrawn.title).toBe("Application Withdrawn");
      expect(withdrawn.title).not.toMatch(/Closed/i);
      expect(withdrawn.description).toContain("withdrawn");
    });

    it("describes offer accepted as acceptance, not signing completion", () => {
      const contract = formatApplicationActivity("issuer", "CONTRACT_OFFER_ACCEPTED");
      const invoice = formatApplicationActivity("issuer", "INVOICE_OFFER_ACCEPTED");
      const signing = formatSigningActivity("issuer", "SIGNING_PACKAGE_COMPLETED");

      expect(contract.title).toBe("Contract Offer Accepted");
      expect(invoice.title).toBe("Invoice Offer Accepted");
      expect(contract.description).toBe("The contract offer was accepted.");
      expect(invoice.description).toBe("The invoice offer was accepted.");
      for (const copy of [contract, invoice]) {
        expect(copy.title + copy.description).not.toMatch(/signed|all signers|signing package completed/i);
      }
      expect(signing.title).toBe("Signing Package Completed");
      expect(signing.description).toBe("All required signers have completed the signing package.");
    });

    it("does not render raw section-review enums", () => {
      const section = formatApplicationActivity("issuer", "APPLICATION_SECTION_REVIEW_UPDATED", {
        newStatus: "AMENDMENT_REQUESTED",
        section: "financial_details",
      });
      expect(section.title).toBe("Section Changes Requested");
      expect(section.description).not.toContain("AMENDMENT_REQUESTED");
      expect(section.description).not.toContain("financial_details");
      expect(section.title).not.toBe(formatApplicationActivity("issuer", "APPLICATION_AMENDMENTS_REQUESTED").title);
    });

    it("uses admin actor fallbacks without inventing names", () => {
      const withActor = formatApplicationActivity("admin", "APPLICATION_SUBMITTED", {
        actorName: "Nora",
      });
      const fallback = formatApplicationActivity("admin", "APPLICATION_SUBMITTED", {});
      expect(withActor.description).toBe("Nora submitted the application for review.");
      expect(fallback.description).toBe("The application was submitted for review.");
    });
  });

  describe("signing", () => {
    it("uses Cancelled for issuer voided packages and Voided for admin", () => {
      const issuer = formatSigningActivity("issuer", "SIGNING_PACKAGE_VOIDED");
      const admin = formatSigningActivity("admin", "SIGNING_PACKAGE_VOIDED");
      expect(issuer.title).toBe("Signing Package Cancelled");
      expect(issuer.description).toBe("The signing package was cancelled.");
      expect(issuer.title + issuer.description).not.toMatch(/voided/i);
      expect(admin.title).toBe("Signing Package Voided");
    });

    it("keeps declined, voided, expired, and recipient-declined wording distinct", () => {
      const titles = [
        formatSigningActivity("issuer", "SIGNING_RECIPIENT_DECLINED").title,
        formatSigningActivity("issuer", "SIGNING_PACKAGE_DECLINED").title,
        formatSigningActivity("issuer", "SIGNING_PACKAGE_VOIDED").title,
        formatSigningActivity("issuer", "SIGNING_PACKAGE_EXPIRED").title,
      ];
      expect(new Set(titles).size).toBe(4);
    });

    it("keeps eKYC failed issuer copy actionable and email-free", () => {
      const issuer = formatSigningActivity("issuer", "SIGNING_EKYC_FAILED", {
        email: "signer@example.com",
        provider: "SIGNINGCLOUD",
      });
      expect(issuer.title).toBe("Signer Identity Check Failed");
      expect(issuer.description).toBe(
        "A signer could not complete identity verification. They need to try again."
      );
      expect(issuer.description).not.toContain("signer@example.com");
      expect(issuer.description).not.toMatch(/ekyc|signingcloud|provider/i);
    });

    it("may include signer email for admin eKYC failed", () => {
      const admin = formatSigningActivity("admin", "SIGNING_EKYC_FAILED", {
        email: "signer@example.com",
      });
      expect(admin.description).toContain("signer@example.com");
      expect(formatSigningActivity("admin", "SIGNING_EKYC_FAILED", {}).description).toBe(
        "Identity verification failed for a signer."
      );
    });
  });

  describe("notes", () => {
    it("maps issuer servicing statuses and never shows raw enums", () => {
      const expected: Record<string, string> = {
        CURRENT: "Repayment On Track",
        PARTIAL: "Partial Payment Recorded",
        ADVANCE_PAID: "Advance Payment Recorded",
        LATE: "Payment Delayed",
        ARREARS: "Payment Overdue",
        DEFAULTED: "Repayment in Default",
        SETTLED: "Servicing Completed",
      };

      for (const [status, title] of Object.entries(expected)) {
        const copy = formatNoteActivity("issuer", "NOTE_SERVICING_STATUS_CHANGED", {
          newServicingStatus: status,
        });
        expect(copy.title).toBe(title);
        expect(copy.description).not.toContain(status);
      }

      const unknown = formatNoteActivity("issuer", "NOTE_SERVICING_STATUS_CHANGED", {
        newServicingStatus: "NOT_STARTED",
      });
      expect(unknown.title).toBe("Servicing Status Updated");
      expect(unknown.description).not.toContain("NOT_STARTED");
    });

    it("keeps formal default wording distinct from servicing default", () => {
      const servicing = formatNoteActivity("issuer", "NOTE_SERVICING_STATUS_CHANGED", {
        newServicingStatus: "DEFAULTED",
      });
      const formal = formatNoteActivity("issuer", "NOTE_MARKED_DEFAULT");
      expect(formal.title).toBe("Note Marked in Default");
      expect(servicing.title).toBe("Repayment in Default");
      expect(formal.title).not.toBe(servicing.title);
      expect(formal.description).not.toBe(servicing.description);
      expect(formal.description).toMatch(/formally marked in default/);
    });

    it("uses distinct issuer and investor note activation copy", () => {
      const issuer = formatNoteActivity("issuer", "NOTE_ACTIVATED");
      const investor = formatNoteActivity("investor", "NOTE_ACTIVATED");
      expect(issuer).toEqual({
        title: "Note Activated",
        description: "The note is now active and servicing has started.",
      });
      expect(investor).toEqual({
        title: "Investment Activated",
        description: "Your investment is now active and servicing has started.",
      });
    });

    it("uses investor-specific settlement copy without aggregate investorAmount", () => {
      const investor = formatNoteActivity("investor", "SETTLEMENT_POSTED", {
        investorAmount: 12500,
        currency: "MYR",
        settlementId: "set_123",
      });
      const issuer = formatNoteActivity("issuer", "SETTLEMENT_POSTED", {
        investorAmount: 12500,
        currency: "MYR",
      });
      expect(investor.title).toBe("Returns Credited");
      expect(investor.description).toBe("Your returns were credited to your CashSouk balance.");
      expect(investor.description).not.toContain("12500");
      expect(investor.description).not.toContain("set_123");
      expect(issuer.title).toBe("Settlement Posted");
      expect(issuer.description).toBe("Settlement was posted.");
    });

    it("renders the viewer’s own amount when amount and currency are present", () => {
      const commitment = formatNoteActivity(
        "investor",
        "INVESTMENT_COMMITTED",
        { amount: 1000, currency: "MYR" }
      );
      const repayment = formatNoteActivity("issuer", "REPAYMENT_RECEIVED", {
        amount: 2500,
        currency: "MYR",
      });
      expect(commitment.description).toContain("MYR 1,000.00");
      expect(repayment.description).toContain("MYR 2,500.00");
    });

    it("falls back safely when amount or currency is missing", () => {
      const missingCurrency = formatNoteActivity("investor", "INVESTMENT_COMMITTED", {
        amount: 1000,
      });
      const missingAmount = formatNoteActivity("issuer", "REPAYMENT_SUBMITTED", {
        currency: "MYR",
      });
      expect(missingCurrency.description).toBe("Your investment was committed.");
      expect(missingAmount.description).toBe("A repayment was submitted and is awaiting review.");
      expect(missingCurrency.description).not.toContain("undefined");
      expect(missingAmount.description).not.toContain("MYR");
    });
  });

  describe("payments", () => {
    it("uses Payment Verification Failed wording for name-check rejection", () => {
      const copy = formatPaymentActivity("investor", "PAYMENT_NAME_CHECK_REJECTED", {
        score: 12,
        result: "NO_MATCH",
      });
      expect(copy.title).toBe("Payment Verification Failed");
      expect(copy.description).not.toMatch(/name check|score|NO_MATCH/i);
    });

    it("keeps refund processing and completed distinct", () => {
      const processing = formatPaymentActivity("investor", "PAYMENT_REFUND_INITIATED");
      const completed = formatPaymentActivity("investor", "PAYMENT_REFUNDED");
      expect(processing.title).toBe("Refund Processing");
      expect(completed.title).toBe("Refund Completed");
      expect(processing.title).not.toBe(completed.title);
    });

    it("keeps withdrawal requested, processing, and completed distinct without trustee wording", () => {
      const requested = formatPaymentActivity("investor", "INVESTOR_WITHDRAWAL_REQUESTED", {
        amount: 500,
        currency: "MYR",
        withdrawalId: "wd_99",
      });
      const processing = formatPaymentActivity("investor", "INVESTOR_WITHDRAWAL_SUBMITTED_TO_TRUSTEE", {
        withdrawalId: "wd_99",
      });
      const completed = formatPaymentActivity("investor", "INVESTOR_WITHDRAWAL_COMPLETED");

      expect(requested.title).toBe("Withdrawal Requested");
      expect(processing.title).toBe("Withdrawal Processing");
      expect(completed.title).toBe("Withdrawal Completed");
      expect(processing.description.toLowerCase()).not.toContain("trustee");
      expect(requested.description).toContain("MYR 500.00");
      expect(requested.description).not.toContain("wd_99");
      expect(new Set([requested.title, processing.title, completed.title]).size).toBe(3);
    });

    it("renders deposit amounts only when both amount and currency exist", () => {
      const withAmount = formatPaymentActivity("investor", "INVESTOR_DEPOSIT_RECEIVED", {
        amount: 750,
        currency: "MYR",
      });
      const fallback = formatPaymentActivity("investor", "INVESTOR_DEPOSIT_RECEIVED", {
        gatewayPaymentId: "pay_1",
      });
      expect(withAmount.description).toContain("MYR 750.00");
      expect(fallback.description).toBe("A deposit was credited to your CashSouk balance.");
      expect(fallback.description).not.toContain("pay_1");
    });
  });

  describe("safety", () => {
    it("never interpolates raw IDs, enums, or JSON into portal copy", () => {
      const samples = [
        formatOnboardingActivity("issuer", "ONBOARDING_REJECTED", {
          reasonCode: "X",
          requestId: "req_1",
        }),
        formatApplicationActivity("issuer", "APPLICATION_SECTION_REVIEW_UPDATED", {
          newStatus: "APPROVED",
          changedFields: { foo: "bar" },
        }),
        formatSigningActivity("issuer", "SIGNING_EKYC_FAILED", {
          recipientId: "rec_1",
          provider: "SIGNINGCLOUD",
        }),
        formatNoteActivity("investor", "SETTLEMENT_POSTED", {
          settlementId: "set_1",
          investorAmount: 9,
        }),
        formatPaymentActivity("investor", "PAYMENT_FAILED", {
          gatewayPaymentId: "gw_1",
        }),
      ];

      for (const copy of samples) {
        expectSafeCopy(copy.title, copy.description);
        expect(copy.description).not.toMatch(/req_1|rec_1|set_1|gw_1|APPROVED|SIGNINGCLOUD/);
        expect(copy.description).not.toContain("{");
      }
    });

    it("keeps issuer and investor Note copy unchanged for Admin-only operational events", () => {
      for (const eventType of ADMIN_NOTE_OPERATIONAL_EVENT_TYPES) {
        expect(formatNoteActivity("issuer", eventType).title).toBe("Note Update");
        expect(formatNoteActivity("investor", eventType).title).toBe("Note Update");
      }
    });
  });

  describe("admin note operational copy", () => {
    const titles: Record<(typeof ADMIN_NOTE_OPERATIONAL_EVENT_TYPES)[number], string> = {
      NOTE_PROSPECTUS_REVIEW_CREATED: "Prospectus Review Started",
      NOTE_PROSPECTUS_APPROVED: "Prospectus Approved",
      NOTE_PROSPECTUS_INVALIDATED: "Prospectus Approval Invalidated",
      DISBURSEMENT_INITIATED: "Disbursement Initiated",
      DISBURSEMENT_LETTER_GENERATED: "Disbursement Letter Generated",
      DISBURSEMENT_SUBMITTED_TO_TRUSTEE: "Disbursement Submitted to Trustee",
      DISBURSEMENT_BENEFICIARY_UPDATED: "Disbursement Beneficiary Updated",
      RESIDUAL_RETURN_LETTER_GENERATED: "Residual Return Letter Generated",
      RESIDUAL_RETURN_SUBMITTED_TO_TRUSTEE: "Residual Return Submitted to Trustee",
      SHORAKA_ORDER_SUBMITTED: "Tawarruq Order Submitted",
      SHORAKA_CERTIFICATE_RECEIVED: "Tawarruq Certificate Received",
      SETTLEMENT_PREVIEWED: "Settlement Preview Generated",
      SETTLEMENT_APPROVED: "Settlement Approved",
      SERVICE_FEE_TRUSTEE_LETTER_GENERATED: "Service Fee Trustee Letter Generated",
      SERVICE_FEE_TRUSTEE_SUBMITTED: "Service Fee Submitted to Trustee",
      SERVICE_FEE_TRUSTEE_COMPLETED: "Service Fee Trustee Processing Completed",
      ARREARS_LETTER_GENERATED: "Arrears Letter Generated",
      DEFAULT_NOTICE_GENERATED: "Default Notice Generated",
    };

    it("gives every remaining Admin Note operational event a stable title", () => {
      for (const eventType of ADMIN_NOTE_OPERATIONAL_EVENT_TYPES) {
        const copy = formatNoteActivity("admin", eventType);
        expect(copy.title).toBe(titles[eventType]);
        expectSafeCopy(copy.title, copy.description);
        expect(copy.title).not.toBe(eventType);
        expect(copy.title).not.toMatch(/_/);
      }
    });

    it("keeps prospectus states distinct", () => {
      const started = formatNoteActivity("admin", "NOTE_PROSPECTUS_REVIEW_CREATED");
      const approved = formatNoteActivity("admin", "NOTE_PROSPECTUS_APPROVED");
      const invalidated = formatNoteActivity("admin", "NOTE_PROSPECTUS_INVALIDATED", {
        reasonCode: "SOURCE_CHANGED",
      });
      expect(new Set([started.title, approved.title, invalidated.title]).size).toBe(3);
      expect(invalidated.description).not.toContain("SOURCE_CHANGED");
      expect(invalidated.description).not.toContain("reasonCode");
    });

    it("keeps trustee workflow stages distinct and document-only", () => {
      const disbursement = [
        formatNoteActivity("admin", "DISBURSEMENT_INITIATED").title,
        formatNoteActivity("admin", "DISBURSEMENT_LETTER_GENERATED").title,
        formatNoteActivity("admin", "DISBURSEMENT_SUBMITTED_TO_TRUSTEE").title,
        formatNoteActivity("admin", "DISBURSEMENT_COMPLETED").title,
      ];
      const residual = [
        formatNoteActivity("admin", "RESIDUAL_RETURN_LETTER_GENERATED").title,
        formatNoteActivity("admin", "RESIDUAL_RETURN_SUBMITTED_TO_TRUSTEE").title,
        formatNoteActivity("admin", "RESIDUAL_RETURN_COMPLETED").title,
      ];
      const serviceFee = [
        formatNoteActivity("admin", "SERVICE_FEE_TRUSTEE_LETTER_GENERATED").title,
        formatNoteActivity("admin", "SERVICE_FEE_TRUSTEE_SUBMITTED").title,
        formatNoteActivity("admin", "SERVICE_FEE_TRUSTEE_COMPLETED").title,
      ];
      expect(new Set(disbursement).size).toBe(4);
      expect(new Set(residual).size).toBe(3);
      expect(new Set(serviceFee).size).toBe(3);
      expect(formatNoteActivity("admin", "DISBURSEMENT_LETTER_GENERATED").description).not.toMatch(
        /completed|paid out|posted/i
      );
      expect(formatNoteActivity("admin", "SERVICE_FEE_TRUSTEE_COMPLETED").description).not.toMatch(
        /settlement was posted|note was repaid/i
      );
    });

    it("keeps settlement preview, approved, and posted distinct", () => {
      const preview = formatNoteActivity("admin", "SETTLEMENT_PREVIEWED", {
        settlementId: "set_1",
        investorAmount: 9000,
        newStatus: "PREVIEW",
      });
      const approved = formatNoteActivity("admin", "SETTLEMENT_APPROVED", {
        displayReference: "SET-001",
        actorName: "Aisha",
      });
      const posted = formatNoteActivity("admin", "SETTLEMENT_POSTED");
      expect(preview.title).toBe("Settlement Preview Generated");
      expect(approved.title).toBe("Settlement Approved");
      expect(posted.title).toBe("Settlement Posted");
      expect(preview.description).not.toContain("set_1");
      expect(preview.description).not.toContain("9000");
      expect(preview.description).not.toContain("PREVIEW");
      expect(approved.description).toBe("Aisha approved settlement SET-001.");
    });

    it("keeps default notice distinct from formal default and servicing default", () => {
      const notice = formatNoteActivity("admin", "DEFAULT_NOTICE_GENERATED");
      const formal = formatNoteActivity("admin", "NOTE_MARKED_DEFAULT");
      const servicing = formatNoteActivity("admin", "NOTE_SERVICING_STATUS_CHANGED", {
        newServicingStatus: "DEFAULTED",
      });
      expect(notice.title).toBe("Default Notice Generated");
      expect(formal.title).toBe("Note Marked in Default");
      expect(servicing.title).toBe("Repayment in Default");
      expect(notice.description).not.toMatch(/formally marked in default|servicing for this note was marked/i);
    });

    it("uses Tawarruq business wording for Admin Shoraka events", () => {
      const order = formatNoteActivity("admin", "SHORAKA_ORDER_SUBMITTED", {
        orderId: "ord_1",
        provider: "SHORAKA",
        actorName: "Nora",
      });
      const certificate = formatNoteActivity("admin", "SHORAKA_CERTIFICATE_RECEIVED", {
        certificateSha256: "abc",
      });
      expect(order.title).toBe("Tawarruq Order Submitted");
      expect(order.description).toBe("Nora submitted the Tawarruq order.");
      expect(certificate.title).toBe("Tawarruq Certificate Received");
      expect(`${order.title} ${order.description} ${certificate.title} ${certificate.description}`).not.toMatch(
        /Shoraka|ord_1|abc/i
      );
    });

    it("falls back safely when optional metadata is missing and does not leak IDs or enums", () => {
      const initiated = formatNoteActivity("admin", "DISBURSEMENT_INITIATED", {
        withdrawalId: "wd_1",
        withdrawalType: "ISSUER_DISBURSEMENT",
        newStatus: "DRAFT",
      });
      const letter = formatNoteActivity("admin", "DISBURSEMENT_LETTER_GENERATED", {});
      const preview = formatNoteActivity("admin", "SETTLEMENT_PREVIEWED", {});
      expect(initiated.description).toBe("Issuer disbursement was initiated.");
      expect(initiated.description).not.toContain("wd_1");
      expect(initiated.description).not.toContain("ISSUER_DISBURSEMENT");
      expect(initiated.description).not.toContain("DRAFT");
      expect(letter.description).toBe("The disbursement trustee letter was generated.");
      expect(preview.description).toBe("A settlement preview was generated.");
    });

    it("interpolates only proven safe Admin metadata", () => {
      expect(
        formatNoteActivity("admin", "DISBURSEMENT_INITIATED", {
          actorName: "Aisha",
          amount: 12000,
          currency: "MYR",
        }).description
      ).toBe("Aisha initiated issuer disbursement of MYR 12,000.00.");
      expect(
        formatNoteActivity("admin", "ARREARS_LETTER_GENERATED", {
          fileName: "arrears-letter.pdf",
        }).description
      ).toBe("The arrears letter arrears-letter.pdf was generated.");
      expect(
        formatNoteActivity("admin", "NOTE_PROSPECTUS_APPROVED", {
          contentVersion: 3,
        }).description
      ).toBe("The prospectus was approved (version 3).");
    });

    it("returns generic fallbacks for unknown events", () => {
      expect(formatOnboardingActivity("issuer", "UNKNOWN_EVENT").title).toBe("Onboarding Update");
      expect(formatApplicationActivity("issuer", "UNKNOWN_EVENT").title).toBe("Application Update");
      expect(formatSigningActivity("issuer", "UNKNOWN_EVENT").title).toBe("Signing Update");
      expect(formatNoteActivity("issuer", "UNKNOWN_EVENT").title).toBe("Note Update");
      expect(formatPaymentActivity("investor", "UNKNOWN_EVENT").title).toBe("Payment Update");
    });
  });
});
