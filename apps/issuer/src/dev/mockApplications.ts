/**
 * Mock application generator for dev debug mode.
 * Only used when process.env.NODE_ENV === "development".
 * Generates realistic NormalizedApplication cards for testing filters, sorting, and lifecycle UI.
 * Covers all FILTER_STATUSES (draft, submitted, under_review, pending_amendment, offer_sent, accepted,
 * completed, withdrawn, rejected) and all NormalizedApplication/NormalizedInvoice fields.
 */

import { WithdrawReason } from "@cashsouk/types";
import type { NormalizedApplication, NormalizedInvoice } from "@/app/(application-management)/applications/status";
import { getCardStatus } from "@/app/(application-management)/applications/status";

function cuidLike(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "c";
  for (let i = 0; i < 24; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function makeInvoice(overrides: Partial<NormalizedInvoice> & { id: string }): NormalizedInvoice {
  return {
    number: "INV-" + Math.floor(1000 + Math.random() * 9000),
    maturityDate: "2026-06-15",
    value: 50000 + Math.floor(Math.random() * 100000),
    appliedFinancing: 40000,
    document: "invoice.pdf",
    documentS3Key: null,
    financingOffered: "—",
    profitRate: "—",
    status: "DRAFT",
    offerStatus: null,
    canReviewOffer: false,
    ...overrides,
  };
}

const CUSTOMERS = [
  "Acme Trading Sdn Bhd",
  "Beta Corp",
  "Delta Industries",
  "Gamma Ltd",
  "Epsilon Co",
  "Zeta Trading",
  "Theta Inc",
  "Kappa Sdn Bhd",
  "Lambda Co",
  "Nu Industries",
  "Omega Holdings",
  "Sigma Solutions",
];

const CONTRACT_TITLES = [
  "Supply Agreement 2026",
  "Master Service Contract",
  "Framework Agreement",
  "Annual Procurement Contract",
  "Distribution Agreement",
];

const DOCUMENT_NAMES = ["invoice.pdf", "proforma_invoice.pdf", "commercial_invoice.pdf", "tax_invoice.pdf"];

/** Scenarios covering all filter statuses. Offer Received at 1–2, Make Amendments at 3, so both appear with default mock count (10). */
const SCENARIOS: Array<{
  appStatus: string;
  contractStatus: string | null;
  invoiceStatuses: string[];
  type: "Contract financing" | "Invoice financing" | "Generic";
  hasContract: boolean;
  invoiceCount: number;
  withdrawReason?: WithdrawReason;
  hasExpiry?: boolean;
  contractTitle?: string;
  hasDocumentS3Key?: boolean;
  maturityDateNull?: boolean;
}> = [
  { appStatus: "DRAFT", contractStatus: null, invoiceStatuses: [], type: "Generic", hasContract: false, invoiceCount: 0 },
  /** Offer Received — Contract: shows "Review Contract Financing Offer". */
  { appStatus: "SUBMITTED", contractStatus: "OFFER_SENT", invoiceStatuses: [], type: "Contract financing", hasContract: true, invoiceCount: 0, hasExpiry: true },
  /** Offer Received — Invoice: shows "Review Invoice Financing Offer" on card. */
  { appStatus: "SUBMITTED", contractStatus: null, invoiceStatuses: ["OFFER_SENT"], type: "Invoice financing", hasContract: false, invoiceCount: 1, hasExpiry: true, hasDocumentS3Key: true },
  /** Action Required — app AMENDMENT_REQUESTED: shows "Make Amendments" on card and in invoice table. */
  { appStatus: "AMENDMENT_REQUESTED", contractStatus: null, invoiceStatuses: ["AMENDMENT_REQUESTED"], type: "Invoice financing", hasContract: false, invoiceCount: 1 },
  { appStatus: "SUBMITTED", contractStatus: "SUBMITTED", invoiceStatuses: ["SUBMITTED"], type: "Contract financing", hasContract: true, invoiceCount: 1 },
  { appStatus: "APPROVED", contractStatus: "APPROVED", invoiceStatuses: ["APPROVED", "APPROVED"], type: "Contract financing", hasContract: true, invoiceCount: 2 },
  { appStatus: "COMPLETED", contractStatus: null, invoiceStatuses: ["APPROVED", "REJECTED"], type: "Invoice financing", hasContract: false, invoiceCount: 2 },
  { appStatus: "WITHDRAWN", contractStatus: null, invoiceStatuses: ["WITHDRAWN", "WITHDRAWN"], type: "Invoice financing", hasContract: false, invoiceCount: 2, withdrawReason: WithdrawReason.USER_CANCELLED },
  { appStatus: "REJECTED", contractStatus: "REJECTED", invoiceStatuses: [], type: "Contract financing", hasContract: true, invoiceCount: 0 },
  { appStatus: "APPROVED", contractStatus: "APPROVED", invoiceStatuses: [], type: "Contract financing", hasContract: true, invoiceCount: 0, hasExpiry: true },
  { appStatus: "COMPLETED", contractStatus: null, invoiceStatuses: ["APPROVED"], type: "Invoice financing", hasContract: false, invoiceCount: 1 },
  { appStatus: "DRAFT", contractStatus: "DRAFT", invoiceStatuses: ["DRAFT"], type: "Contract financing", hasContract: true, invoiceCount: 1 },
  { appStatus: "UNDER_REVIEW", contractStatus: "SUBMITTED", invoiceStatuses: ["SUBMITTED"], type: "Contract financing", hasContract: true, invoiceCount: 1 },
  { appStatus: "COMPLETED", contractStatus: "APPROVED", invoiceStatuses: ["APPROVED", "REJECTED"], type: "Contract financing", hasContract: true, invoiceCount: 2 },
  { appStatus: "WITHDRAWN", contractStatus: null, invoiceStatuses: ["WITHDRAWN"], type: "Invoice financing", hasContract: false, invoiceCount: 1, withdrawReason: WithdrawReason.OFFER_EXPIRED },
  { appStatus: "SUBMITTED", contractStatus: "OFFER_SENT", invoiceStatuses: ["OFFER_SENT", "DRAFT"], type: "Contract financing", hasContract: true, invoiceCount: 2, hasExpiry: true },
  { appStatus: "SUBMITTED", contractStatus: null, invoiceStatuses: ["OFFER_SENT", "SUBMITTED", "DRAFT"], type: "Invoice financing", hasContract: false, invoiceCount: 3, hasExpiry: true },
  { appStatus: "RESUBMITTED", contractStatus: "SUBMITTED", invoiceStatuses: ["SUBMITTED"], type: "Contract financing", hasContract: true, invoiceCount: 1 },
  { appStatus: "APPROVED", contractStatus: null, invoiceStatuses: ["APPROVED", "APPROVED"], type: "Invoice financing", hasContract: false, invoiceCount: 2 },
  { appStatus: "SUBMITTED", contractStatus: "AMENDMENT_REQUESTED", invoiceStatuses: ["SUBMITTED"], type: "Contract financing", hasContract: true, invoiceCount: 1 },
  { appStatus: "SUBMITTED", contractStatus: null, invoiceStatuses: ["SUBMITTED"], type: "Invoice financing", hasContract: false, invoiceCount: 1, maturityDateNull: true },
];

export function generateMockApplications(count: number): NormalizedApplication[] {
  const result: NormalizedApplication[] = [];
  const now = new Date();
  const usedCustomers = new Set<string>();

  for (let i = 0; i < count; i++) {
    const scenario = SCENARIOS[i % SCENARIOS.length];
    const appId = cuidLike();
    const contractId = scenario.hasContract ? "ctr-" + cuidLike().slice(0, 12) : null;

    const invoices: NormalizedInvoice[] = [];
    for (let j = 0; j < scenario.invoiceCount; j++) {
      const invStatus = scenario.invoiceStatuses[j] ?? "DRAFT";
      const offerStatus = invStatus === "OFFER_SENT" ? ("Offer received" as const) : null;
      const canReview =
        offerStatus === "Offer received" &&
        (scenario.contractStatus === "APPROVED" || scenario.contractStatus === "OFFER_SENT" || !scenario.contractStatus);
      const hasOffer = invStatus === "OFFER_SENT" || invStatus === "APPROVED";
      const invDocS3 = scenario.hasDocumentS3Key && j === 0 ? "uploads/mock-invoice-sample.pdf" : null;
      const matDate = scenario.maturityDateNull && j === 0 ? null : `2026-0${6 + (j % 3)}-${Math.min(15 + j, 28)}`;
      const invValue = 30000 + Math.floor(Math.random() * 120000);
      const invApplied = Math.floor(invValue * 0.8);

      invoices.push(
        makeInvoice({
          id: "inv-" + cuidLike().slice(0, 12),
          number: `INV-${2000 + i * 10 + j}`,
          maturityDate: matDate,
          value: invValue,
          appliedFinancing: invApplied,
          document: DOCUMENT_NAMES[j % DOCUMENT_NAMES.length],
          documentS3Key: invDocS3,
          status: invStatus,
          offerStatus,
          canReviewOffer: !!canReview,
          financingOffered: hasOffer ? `RM ${(invApplied * 1.1).toLocaleString("en-MY", { minimumFractionDigits: 2 })}` : "—",
          profitRate: hasOffer ? `${7 + (j % 3)}%` : "—",
        })
      );
    }

    const cardStatus = getCardStatus({
      applicationStatus: scenario.appStatus,
      contractStatus: scenario.contractStatus,
      invoiceStatuses: scenario.invoiceStatuses,
    });

    let customer = CUSTOMERS[i % CUSTOMERS.length];
    if (usedCustomers.has(customer)) {
      customer = customer + " " + (i + 1);
    }
    usedCustomers.add(customer);

    const daysAgo = Math.floor(Math.random() * 30) + 1;
    const updatedDate = new Date(now);
    updatedDate.setDate(updatedDate.getDate() - daysAgo);
    const createdDate = new Date(updatedDate);
    createdDate.setDate(createdDate.getDate() - Math.floor(Math.random() * 5));

    const hasSubmitted = !["DRAFT", "Generic"].includes(scenario.appStatus) && scenario.type !== "Generic";
    const submittedAt = hasSubmitted ? createdDate.toISOString() : null;

    let expiresAt: string | undefined;
    if (scenario.hasExpiry) {
      const exp = new Date(now);
      exp.setDate(exp.getDate() + (i % 3 === 0 ? 2 : i % 3 === 1 ? 7 : 15));
      expiresAt = exp.toISOString();
    }

    const contractVal = scenario.hasContract ? 200000 + Math.floor(Math.random() * 300000) : null;
    const facilityApplied = scenario.hasContract ? Math.floor((contractVal ?? 0) * 0.9) : null;
    const hasOfferOrApproved =
      scenario.contractStatus === "OFFER_SENT" || scenario.contractStatus === "APPROVED";
    const approvedFacility = hasOfferOrApproved
      ? `RM ${((facilityApplied ?? 180000) * 1.05).toLocaleString("en-MY", { minimumFractionDigits: 2 })}`
      : scenario.contractStatus === "APPROVED"
        ? "RM 200,000.00"
        : "N/A";

    const contractTitle = scenario.hasContract
      ? scenario.contractTitle ?? CONTRACT_TITLES[i % CONTRACT_TITLES.length]
      : null;

    result.push({
      id: appId,
      type: scenario.type,
      status: cardStatus.badgeKey,
      cardStatus,
      contractTitle,
      contractId,
      customer,
      applicationDate: createdDate.toISOString().slice(0, 10),
      submittedAt,
      contractValue: contractVal,
      facilityApplied,
      approvedFacility,
      updatedAt: updatedDate.toISOString(),
      invoices,
      contractStatus: scenario.contractStatus,
      issuerOrganizationId: "org-mock-1",
      withdrawReason: scenario.withdrawReason,
      expiresAt,
    });
  }

  return result;
}
