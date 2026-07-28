import { ApplicationStatus } from "@cashsouk/types";
import {
  extractPrimaryOfferAcceptanceStatus,
  isExistingContractFinancing,
  resolveApplicationStatusAfterCommercialAccept,
  resolveApplicationStatusAfterOfferAcceptanceSubmit,
  resolveApplicationStatusFromOfferAcceptancePhase,
  resolveInvoiceCentricApplicationStatus,
} from "./offer-application-status";

describe("resolveApplicationStatusAfterOfferAcceptanceSubmit", () => {
  it("maps contract submit to CONTRACT_ACCEPTED", () => {
    expect(
      resolveApplicationStatusAfterOfferAcceptanceSubmit(false, "PENDING_ADMIN_REVIEW")
    ).toBe(ApplicationStatus.CONTRACT_ACCEPTED);
  });

  it("maps invoice-only submit to INVOICE_ACCEPTED", () => {
    expect(
      resolveApplicationStatusAfterOfferAcceptanceSubmit(true, "PENDING_ADMIN_REVIEW")
    ).toBe(ApplicationStatus.INVOICE_ACCEPTED);
  });

  it("maps auto-approve to SIGNING_PENDING", () => {
    expect(
      resolveApplicationStatusAfterOfferAcceptanceSubmit(false, "APPROVED_FOR_SIGNING")
    ).toBe(ApplicationStatus.SIGNING_PENDING);
  });
});

describe("resolveApplicationStatusFromOfferAcceptancePhase", () => {
  it("maps review phases to accepted statuses", () => {
    expect(
      resolveApplicationStatusFromOfferAcceptancePhase(false, "PENDING_ADMIN_REVIEW")
    ).toBe(ApplicationStatus.CONTRACT_ACCEPTED);
    expect(
      resolveApplicationStatusFromOfferAcceptancePhase(true, "CHANGES_REQUESTED")
    ).toBe(ApplicationStatus.INVOICE_ACCEPTED);
  });

  it("maps signing phases to SIGNING_PENDING", () => {
    expect(
      resolveApplicationStatusFromOfferAcceptancePhase(false, "APPROVED_FOR_SIGNING")
    ).toBe(ApplicationStatus.SIGNING_PENDING);
    expect(
      resolveApplicationStatusFromOfferAcceptancePhase(true, "SIGNING_IN_PROGRESS")
    ).toBe(ApplicationStatus.SIGNING_PENDING);
  });

  it("maps completed + entity approved to signed statuses", () => {
    expect(
      resolveApplicationStatusFromOfferAcceptancePhase(false, "COMPLETED", {
        entityApproved: true,
      })
    ).toBe(ApplicationStatus.CONTRACT_SIGNED);
    expect(
      resolveApplicationStatusFromOfferAcceptancePhase(true, "COMPLETED", {
        entityApproved: true,
      })
    ).toBe(ApplicationStatus.INVOICE_SIGNED);
  });

  it("returns null without offer acceptance", () => {
    expect(resolveApplicationStatusFromOfferAcceptancePhase(false, null)).toBeNull();
  });
});

describe("resolveApplicationStatusAfterCommercialAccept", () => {
  it("uses signed statuses for phased accept", () => {
    expect(
      resolveApplicationStatusAfterCommercialAccept({
        isInvoiceOnly: false,
        hasOfferAcceptance: true,
        action: "accept",
        isContractPath: true,
      })
    ).toBe(ApplicationStatus.CONTRACT_SIGNED);
    expect(
      resolveApplicationStatusAfterCommercialAccept({
        isInvoiceOnly: true,
        hasOfferAcceptance: true,
        action: "accept",
        isContractPath: false,
      })
    ).toBe(ApplicationStatus.INVOICE_SIGNED);
  });

  it("returns null for legacy direct accept", () => {
    expect(
      resolveApplicationStatusAfterCommercialAccept({
        isInvoiceOnly: false,
        hasOfferAcceptance: false,
        action: "accept",
        isContractPath: true,
      })
    ).toBeNull();
  });
});

describe("extractPrimaryOfferAcceptanceStatus", () => {
  it("reads contract offer acceptance on contract path", () => {
    expect(
      extractPrimaryOfferAcceptanceStatus({
        financing_structure: { structure_type: "new_contract" },
        contract: {
          offer_details: { offer_acceptance: { status: "PENDING_ADMIN_REVIEW" } },
        },
      })
    ).toBe("PENDING_ADMIN_REVIEW");
  });

  it("reads standalone invoice offer acceptance on invoice-only path", () => {
    expect(
      extractPrimaryOfferAcceptanceStatus({
        financing_structure: { structure_type: "invoice_only" },
        invoices: [
          {
            contract_id: null,
            offer_details: { offer_acceptance: { status: "SIGNING_IN_PROGRESS" } },
          },
        ],
      })
    ).toBe("SIGNING_IN_PROGRESS");
  });

  it("ignores stale contract offer acceptance on existing_contract", () => {
    expect(
      extractPrimaryOfferAcceptanceStatus({
        financing_structure: { structure_type: "existing_contract" },
        contract: {
          offer_details: { offer_acceptance: { status: "COMPLETED" } },
        },
      })
    ).toBeNull();
  });
});

describe("resolveInvoiceCentricApplicationStatus", () => {
  it("returns UNDER_REVIEW when invoice tab is locked", () => {
    expect(
      resolveInvoiceCentricApplicationStatus({
        invoiceStatuses: ["DRAFT"],
        isInvoiceTabUnlocked: false,
        isInvoiceOnly: false,
      })
    ).toBe(ApplicationStatus.UNDER_REVIEW);
  });

  it("returns INVOICE_PENDING when invoice tab is unlocked", () => {
    expect(
      resolveInvoiceCentricApplicationStatus({
        invoiceStatuses: ["SUBMITTED"],
        isInvoiceTabUnlocked: true,
        isInvoiceOnly: false,
      })
    ).toBe(ApplicationStatus.INVOICE_PENDING);
  });

  it("returns INVOICES_SENT when all invoices are offerable or resolved", () => {
    expect(
      resolveInvoiceCentricApplicationStatus({
        invoiceStatuses: ["OFFER_SENT"],
        isInvoiceTabUnlocked: true,
        isInvoiceOnly: false,
      })
    ).toBe(ApplicationStatus.INVOICES_SENT);
  });
});

describe("isExistingContractFinancing", () => {
  it("detects existing_contract structure", () => {
    expect(isExistingContractFinancing({ structure_type: "existing_contract" })).toBe(true);
    expect(isExistingContractFinancing({ structure_type: "new_contract" })).toBe(false);
  });
});
