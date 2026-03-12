/**
 * Mock application generator for dev debug mode.
 * Only used when process.env.NODE_ENV === "development".
 * Generates realistic NormalizedApplication cards for testing filters, sorting, and lifecycle UI.
 */

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

const SCENARIOS: Array<{
  appStatus: string;
  contractStatus: string | null;
  invoiceStatuses: string[];
  type: "Contract financing" | "Invoice financing" | "Generic";
  hasContract: boolean;
  invoiceCount: number;
}> = [
  { appStatus: "DRAFT", contractStatus: null, invoiceStatuses: [], type: "Generic", hasContract: false, invoiceCount: 0 },
  { appStatus: "SUBMITTED", contractStatus: "SUBMITTED", invoiceStatuses: ["SUBMITTED"], type: "Contract financing", hasContract: true, invoiceCount: 1 },
  { appStatus: "APPROVED", contractStatus: "APPROVED", invoiceStatuses: ["APPROVED", "APPROVED"], type: "Contract financing", hasContract: true, invoiceCount: 2 },
  { appStatus: "COMPLETED", contractStatus: null, invoiceStatuses: ["APPROVED", "REJECTED"], type: "Invoice financing", hasContract: false, invoiceCount: 2 },
  { appStatus: "WITHDRAWN", contractStatus: null, invoiceStatuses: ["WITHDRAWN", "WITHDRAWN"], type: "Invoice financing", hasContract: false, invoiceCount: 2 },
  { appStatus: "REJECTED", contractStatus: "REJECTED", invoiceStatuses: [], type: "Contract financing", hasContract: true, invoiceCount: 0 },
  { appStatus: "APPROVED", contractStatus: "APPROVED", invoiceStatuses: [], type: "Contract financing", hasContract: true, invoiceCount: 0 },
  { appStatus: "COMPLETED", contractStatus: null, invoiceStatuses: ["APPROVED"], type: "Invoice financing", hasContract: false, invoiceCount: 1 },
  { appStatus: "DRAFT", contractStatus: "DRAFT", invoiceStatuses: ["DRAFT"], type: "Contract financing", hasContract: true, invoiceCount: 1 },
  { appStatus: "UNDER_REVIEW", contractStatus: "SUBMITTED", invoiceStatuses: ["SUBMITTED"], type: "Contract financing", hasContract: true, invoiceCount: 1 },
  { appStatus: "AMENDMENT_REQUESTED", contractStatus: null, invoiceStatuses: ["AMENDMENT_REQUESTED"], type: "Invoice financing", hasContract: false, invoiceCount: 1 },
  { appStatus: "COMPLETED", contractStatus: "APPROVED", invoiceStatuses: ["APPROVED", "REJECTED"], type: "Contract financing", hasContract: true, invoiceCount: 2 },
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
      const offerStatus = invStatus === "OFFER_SENT" ? "Offer received" : null;
      const canReview = offerStatus && (scenario.contractStatus === "APPROVED" || !scenario.contractStatus);
      invoices.push(
        makeInvoice({
          id: "inv-" + cuidLike().slice(0, 12),
          status: invStatus,
          offerStatus,
          canReviewOffer: !!canReview,
          financingOffered: invStatus === "OFFER_SENT" || invStatus === "APPROVED" ? "RM 50,000.00" : "—",
          profitRate: invStatus === "OFFER_SENT" || invStatus === "APPROVED" ? "8%" : "—",
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

    result.push({
      id: appId,
      type: scenario.type,
      status: cardStatus.badgeKey,
      cardStatus,
      contractTitle: scenario.hasContract ? "Contract " + (i + 1) : null,
      contractId,
      customer,
      applicationDate: createdDate.toISOString().slice(0, 10),
      submittedAt,
      contractValue: scenario.hasContract ? 200000 + Math.floor(Math.random() * 300000) : null,
      facilityApplied: scenario.hasContract ? 180000 : null,
      approvedFacility: scenario.contractStatus === "APPROVED" ? "RM 200,000.00" : "N/A",
      updatedAt: updatedDate.toISOString(),
      invoices,
      contractStatus: scenario.contractStatus,
      issuerOrganizationId: "org-mock-1",
    });
  }

  return result;
}
