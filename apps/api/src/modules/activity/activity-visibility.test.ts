import {
  isAdminApplicationTimelineVisible,
  isApplicationActivityVisible,
  isDirectorKycActivityVisible,
  isIssuerNoteTermsVisible,
  isNoteActivityVisible,
  isOnboardingActivityVisible,
  isPaymentActivityVisible,
  isSigningActivityVisible,
  isSophisticatedStatusMaterial,
  settlementHasInvestorAllocation,
} from "@cashsouk/types";

describe("activity visibility matrix", () => {
  describe("onboarding", () => {
    it("hides final approval from issuer and investor activity", () => {
      expect(isOnboardingActivityVisible("issuer", "ONBOARDING_FINAL_APPROVAL_COMPLETED")).toBe(false);
      expect(isOnboardingActivityVisible("investor", "ONBOARDING_FINAL_APPROVAL_COMPLETED")).toBe(false);
    });

    it("keeps the core user-facing onboarding milestones", () => {
      for (const eventType of [
        "ONBOARDING_STARTED",
        "ONBOARDING_RESTARTED",
        "ONBOARDING_APPROVED",
        "ONBOARDING_REJECTED",
        "ONBOARDING_COMPLETED",
      ]) {
        expect(isOnboardingActivityVisible("issuer", eventType)).toBe(true);
        expect(isOnboardingActivityVisible("investor", eventType)).toBe(true);
      }
      expect(isOnboardingActivityVisible("issuer", "ONBOARDING_RESUMED")).toBe(false);
      expect(isOnboardingActivityVisible("investor", "ONBOARDING_RESUMED")).toBe(false);
      expect(isOnboardingActivityVisible("admin", "ORGANIZATION_PROFILE_UPDATED_BY_ADMIN")).toBe(true);
      expect(isOnboardingActivityVisible("issuer", "ORGANIZATION_PROFILE_UPDATED_BY_ADMIN")).toBe(false);
      expect(isOnboardingActivityVisible("investor", "ORGANIZATION_PROFILE_UPDATED_BY_ADMIN")).toBe(false);
    });

    it("shows sophisticated status only when the investor eligibility value changes", () => {
      expect(
        isOnboardingActivityVisible("investor", "INVESTOR_SOPHISTICATED_STATUS_UPDATED", {
          previousValue: false,
          newValue: true,
        })
      ).toBe(true);
      expect(
        isOnboardingActivityVisible("investor", "INVESTOR_SOPHISTICATED_STATUS_UPDATED", {
          previousValue: true,
          newValue: true,
        })
      ).toBe(false);
      expect(
        isOnboardingActivityVisible("issuer", "INVESTOR_SOPHISTICATED_STATUS_UPDATED", {
          previousValue: false,
          newValue: true,
        })
      ).toBe(false);
      expect(isSophisticatedStatusMaterial({ previousValue: false })).toBe(false);
    });

    it("shows director invitations only for issuer company onboarding", () => {
      expect(
        isOnboardingActivityVisible("issuer", "DIRECTOR_ONBOARDING_INVITATION_SENT", {}, {
          organizationKind: "ISSUER",
          organizationType: "COMPANY",
        })
      ).toBe(true);
      expect(
        isOnboardingActivityVisible("issuer", "DIRECTOR_ONBOARDING_INVITATION_SENT", {}, {
          organizationKind: "ISSUER",
          organizationType: "INDIVIDUAL",
        })
      ).toBe(false);
      expect(
        isOnboardingActivityVisible("investor", "DIRECTOR_ONBOARDING_INVITATION_SENT", {}, {
          organizationKind: "ISSUER",
          organizationType: "COMPANY",
        })
      ).toBe(false);
    });

    it("shows director KYC only for meaningful states", () => {
      expect(
        isOnboardingActivityVisible("issuer", "DIRECTOR_KYC_STATUS_UPDATED", {
          newKycStatus: "APPROVED",
        })
      ).toBe(true);
      expect(
        isOnboardingActivityVisible("issuer", "DIRECTOR_KYC_STATUS_UPDATED", {
          newKycStatus: "REJECTED",
        })
      ).toBe(true);
      expect(
        isOnboardingActivityVisible("issuer", "DIRECTOR_KYC_STATUS_UPDATED", {
          newKycStatus: "ACTION_REQUIRED",
        })
      ).toBe(true);
      expect(
        isOnboardingActivityVisible("issuer", "DIRECTOR_KYC_STATUS_UPDATED", {
          newKycStatus: "WAIT_FOR_APPROVAL",
        })
      ).toBe(false);
      expect(
        isOnboardingActivityVisible("issuer", "DIRECTOR_KYC_STATUS_UPDATED", {
          newKycStatus: "LIVENESS_STARTED",
        })
      ).toBe(false);
      expect(isDirectorKycActivityVisible("PENDING")).toBe(false);
    });

    it("hides noisy admin organization timeline events while leaving other admin events visible", () => {
      expect(isOnboardingActivityVisible("admin", "USER_ONBOARDING_STATUS_UPDATED")).toBe(false);
      expect(isOnboardingActivityVisible("admin", "ONBOARDING_STATUS_CHANGED")).toBe(true);
      expect(isOnboardingActivityVisible("admin", "ONBOARDING_FINAL_APPROVAL_COMPLETED")).toBe(true);
      expect(isOnboardingActivityVisible("admin", "CORPORATE_ENTITIES_UPDATED")).toBe(true);
      expect(isOnboardingActivityVisible("admin", "CTOS_REPORT_RECEIVED")).toBe(true);
      expect(isOnboardingActivityVisible("issuer", "CTOS_REPORT_RECEIVED")).toBe(false);
      expect(isOnboardingActivityVisible("investor", "CTOS_REPORT_RECEIVED")).toBe(false);
    });

    it("shows review and amendment STATUS_CHANGED transitions to users", () => {
      expect(
        isOnboardingActivityVisible("issuer", "ONBOARDING_STATUS_CHANGED", {
          previousStatus: "IN_PROGRESS",
          newStatus: "PENDING_SSM_REVIEW",
        })
      ).toBe(true);
      expect(
        isOnboardingActivityVisible("investor", "ONBOARDING_STATUS_CHANGED", {
          previousStatus: "PENDING",
          newStatus: "PENDING_APPROVAL",
        })
      ).toBe(true);
      expect(
        isOnboardingActivityVisible("issuer", "ONBOARDING_STATUS_CHANGED", {
          previousStatus: "PENDING_SSM_REVIEW",
          newStatus: "PENDING_AMENDMENT",
        })
      ).toBe(true);
      expect(
        isOnboardingActivityVisible("issuer", "ONBOARDING_STATUS_CHANGED", {
          previousStatus: "PENDING_AMENDMENT",
          newStatus: "PENDING_SSM_REVIEW",
        })
      ).toBe(true);
      expect(
        isOnboardingActivityVisible("issuer", "ONBOARDING_STATUS_CHANGED", {
          previousStatus: "PENDING_APPROVAL",
          newStatus: "PENDING_AML",
        })
      ).toBe(false);
    });
  });

  describe("application", () => {
    it("keeps major lifecycle events visible to issuer and admin", () => {
      for (const eventType of [
        "APPLICATION_CREATED",
        "APPLICATION_SUBMITTED",
        "APPLICATION_RESUBMITTED",
        "APPLICATION_AMENDMENTS_REQUESTED",
        "APPLICATION_REOPENED_FOR_REVIEW",
        "APPLICATION_WITHDRAWN",
        "APPLICATION_REJECTED",
        "APPLICATION_COMPLETED",
        "CONTRACT_OFFER_SENT",
        "INVOICE_ACCEPTANCE_SUBMITTED",
      ]) {
        expect(isApplicationActivityVisible("issuer", eventType)).toBe(true);
        expect(isApplicationActivityVisible("admin", eventType)).toBe(true);
      }
    });

    it("hides review-start and internal file noise from issuer activity", () => {
      for (const eventType of [
        "APPLICATION_REVIEW_STARTED",
        "APPLICATION_AMENDMENT_ACKNOWLEDGED",
        "APPLICATION_ARCHIVED",
        "APPLICATION_DRAFT_DELETED",
        "APPLICATION_ITEM_REVIEW_UPDATED",
        "APPLICATION_DOCUMENT_UPLOADED",
        "APPLICATION_DOCUMENT_REMOVED",
        "APPLICATION_DOCUMENT_REPLACED",
        "CONTRACT_CUSTOMER_LARGE_PRIVATE_UPDATED",
      ]) {
        expect(isApplicationActivityVisible("issuer", eventType)).toBe(false);
      }
    });

    it("shows review started only on the admin curated timeline", () => {
      expect(isApplicationActivityVisible("admin", "APPLICATION_REVIEW_STARTED")).toBe(true);
      expect(isAdminApplicationTimelineVisible("APPLICATION_REVIEW_STARTED")).toBe(true);
    });

    it("shows section review only when amendment is required", () => {
      expect(
        isApplicationActivityVisible("issuer", "APPLICATION_SECTION_REVIEW_UPDATED", {
          newStatus: "AMENDMENT_REQUESTED",
        })
      ).toBe(true);
      expect(
        isApplicationActivityVisible("admin", "APPLICATION_SECTION_REVIEW_UPDATED", {
          newStatus: "REQUEST_AMENDMENT",
        })
      ).toBe(true);
      expect(
        isApplicationActivityVisible("issuer", "APPLICATION_SECTION_REVIEW_UPDATED", {
          newStatus: "APPROVED",
        })
      ).toBe(false);
    });

    it("never shows application events to investors", () => {
      expect(isApplicationActivityVisible("investor", "APPLICATION_SUBMITTED")).toBe(false);
      expect(
        isApplicationActivityVisible("investor", "APPLICATION_SECTION_REVIEW_UPDATED", {
          newStatus: "AMENDMENT_REQUESTED",
        })
      ).toBe(false);
    });
  });

  describe("signing", () => {
    it("shows the approved issuer signing lifecycle set", () => {
      for (const eventType of [
        "SIGNING_PACKAGE_SENT",
        "SIGNING_PACKAGE_COMPLETED",
        "SIGNING_PACKAGE_VOIDED",
        "SIGNING_PACKAGE_DECLINED",
        "SIGNING_PACKAGE_EXPIRED",
        "SIGNING_RECIPIENT_DECLINED",
        "SIGNING_EKYC_FAILED",
      ]) {
        expect(isSigningActivityVisible("issuer", eventType)).toBe(true);
      }
    });

    it("hides created, recipient completed, started, verified, and reminder from issuer", () => {
      for (const eventType of [
        "SIGNING_PACKAGE_CREATED",
        "SIGNING_RECIPIENT_COMPLETED",
        "SIGNING_EKYC_STARTED",
        "SIGNING_EKYC_VERIFIED",
        "SIGNING_REMINDER_SENT",
      ]) {
        expect(isSigningActivityVisible("issuer", eventType)).toBe(false);
      }
    });

    it("keeps package created and recipient completed on admin curated activity", () => {
      expect(isAdminApplicationTimelineVisible("SIGNING_PACKAGE_CREATED")).toBe(true);
      expect(isAdminApplicationTimelineVisible("SIGNING_RECIPIENT_COMPLETED")).toBe(true);
      expect(isAdminApplicationTimelineVisible("SIGNING_EKYC_STARTED")).toBe(false);
      expect(isAdminApplicationTimelineVisible("SIGNING_REMINDER_SENT")).toBe(false);
    });
  });

  describe("note", () => {
    it("shows the approved issuer note additions and hides prospectus", () => {
      expect(isNoteActivityVisible("issuer", "NOTE_UNPUBLISHED")).toBe(true);
      expect(isNoteActivityVisible("issuer", "NOTE_CAMPAIGN_PAUSED")).toBe(true);
      expect(isNoteActivityVisible("issuer", "NOTE_CAMPAIGN_RESUMED")).toBe(true);
      expect(isNoteActivityVisible("issuer", "REPAYMENT_RECEIVED")).toBe(true);
      expect(isNoteActivityVisible("issuer", "REPAYMENT_REJECTED")).toBe(true);
      expect(isNoteActivityVisible("issuer", "RESIDUAL_RETURN_COMPLETED")).toBe(true);
      expect(isNoteActivityVisible("issuer", "NOTE_PROSPECTUS_REVIEW_CREATED")).toBe(false);
      expect(isNoteActivityVisible("issuer", "NOTE_PROSPECTUS_APPROVED")).toBe(false);
      expect(isNoteActivityVisible("issuer", "SETTLEMENT_POSTED")).toBe(false);
    });

    it("shows note terms updates only after the note is already visible to the issuer", () => {
      expect(
        isNoteActivityVisible("issuer", "NOTE_TERMS_UPDATED", {}, { noteVisibleToIssuer: true })
      ).toBe(true);
      expect(
        isNoteActivityVisible("issuer", "NOTE_TERMS_UPDATED", {}, { noteVisibleToIssuer: false })
      ).toBe(false);
      expect(isIssuerNoteTermsVisible({ listingStatus: "DRAFT", publishedAt: null })).toBe(false);
      expect(isIssuerNoteTermsVisible({ listingStatus: "PUBLISHED", publishedAt: null })).toBe(true);
      expect(isIssuerNoteTermsVisible({ listingStatus: "DRAFT", publishedAt: new Date() })).toBe(true);
    });

    it("does not leak funding, activation, or default events to unrelated investors", () => {
      expect(
        isNoteActivityVisible("investor", "NOTE_FUNDING_CLOSED", {}, { investorCommitted: false })
      ).toBe(false);
      expect(
        isNoteActivityVisible("investor", "NOTE_CAMPAIGN_PAUSED", {}, { investorCommitted: true })
      ).toBe(true);
      expect(
        isNoteActivityVisible("investor", "NOTE_CAMPAIGN_PAUSED", {}, { investorCommitted: false })
      ).toBe(false);
      expect(
        isNoteActivityVisible("investor", "NOTE_CAMPAIGN_RESUMED", {}, { investorCommitted: true })
      ).toBe(true);
      expect(
        isNoteActivityVisible("investor", "NOTE_MARKED_DEFAULT", {}, { investorCommitted: false })
      ).toBe(false);
    });

    it("shows servicing changes only for committed investors on material states", () => {
      expect(
        isNoteActivityVisible(
          "investor",
          "NOTE_SERVICING_STATUS_CHANGED",
          { newServicingStatus: "ARREARS" },
          { investorCommitted: true }
        )
      ).toBe(true);
      expect(
        isNoteActivityVisible(
          "investor",
          "NOTE_SERVICING_STATUS_CHANGED",
          { newServicingStatus: "CURRENT" },
          { investorCommitted: true }
        )
      ).toBe(false);
      expect(
        isNoteActivityVisible(
          "investor",
          "NOTE_SERVICING_STATUS_CHANGED",
          { newServicingStatus: "DEFAULTED" },
          { investorCommitted: false }
        )
      ).toBe(false);
    });

    it("shows settlement posted only when that investor has an allocation", () => {
      expect(
        isNoteActivityVisible("investor", "SETTLEMENT_POSTED", {}, {
          settlementHasInvestorAllocation: true,
        })
      ).toBe(true);
      expect(
        isNoteActivityVisible("investor", "SETTLEMENT_POSTED", {}, {
          settlementHasInvestorAllocation: false,
        })
      ).toBe(false);
      expect(
        settlementHasInvestorAllocation(
          { allocations: [{ investorOrganizationId: "org-1", investmentId: "inv-1" }] },
          "org-1"
        )
      ).toBe(true);
      expect(
        settlementHasInvestorAllocation(
          { allocations: [{ investorOrganizationId: "org-2", investmentId: "inv-1" }] },
          "org-1"
        )
      ).toBe(false);
    });
  });

  describe("payment", () => {
    it("shows selected investor payment events only to the owning organization", () => {
      expect(
        isPaymentActivityVisible("investor", "PAYMENT_FAILED", {
          organizationId: "org-1",
          ownerOrganizationId: "org-1",
        })
      ).toBe(true);
      expect(
        isPaymentActivityVisible("investor", "INVESTOR_WITHDRAWAL_COMPLETED", {
          organizationId: "org-1",
          ownerOrganizationId: "org-2",
        })
      ).toBe(false);
      expect(
        isPaymentActivityVisible("issuer", "PAYMENT_FAILED", {
          organizationId: "org-1",
          ownerOrganizationId: "org-1",
        })
      ).toBe(false);
    });

    it("applies refund ownership and hides gateway or recon internals", () => {
      expect(
        isPaymentActivityVisible("investor", "PAYMENT_REFUNDED", {
          organizationId: "org-1",
          ownerOrganizationId: "org-1",
        })
      ).toBe(true);
      expect(
        isPaymentActivityVisible("investor", "PAYMENT_REFUND_INITIATED", {
          organizationId: "org-1",
          ownerOrganizationId: "org-2",
        })
      ).toBe(false);
      expect(
        isPaymentActivityVisible("investor", "PAYMENT_INITIATED", {
          organizationId: "org-1",
          ownerOrganizationId: "org-1",
        })
      ).toBe(false);
      expect(
        isPaymentActivityVisible("investor", "PAYMENT_RECONCILIATION_EXCEPTION_DETECTED", {
          organizationId: "org-1",
          ownerOrganizationId: "org-1",
        })
      ).toBe(false);
    });
  });
});
