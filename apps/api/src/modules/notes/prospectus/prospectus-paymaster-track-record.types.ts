/**
 * SECTION: Prospectus Page 2 — Paymaster Track Record (DATA STAGE 3)
 * WHY: Officer-entered prospectus content; no system paymaster-history aggregate yet
 */

import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

/** Static Canva section title — not a database field. */
export const PROSPECTUS_PAYMASTER_TRACK_RECORD_SECTION_HEADING = "PAYMASTER TRACK RECORD";

/**
 * Total Amount Paid display uses formatProspectusMoneyMyr only.
 * Compact money (mil / million / m) is rejected.
 */
export const PROSPECTUS_PAYMASTER_TRACK_RECORD_FUTURE_MONEY_FORMATTER =
  "formatProspectusMoneyMyr" as const;

export interface ProspectusPaymasterTrackRecordAudit {
  identity: {
    stableGroupingKeyAvailable: false;
    candidateKeys: readonly [
      "notes.paymaster_snapshot.ssm_number",
      "notes.paymaster_snapshot.name",
    ];
    groupingDecision: "pending";
    nameGroupingApproved: false;
  };
  totalInvoicesPaid: {
    source: "prospectus_review.page2.paymasterTrackRecord.totalInvoicesPaid";
    isOfficerContent: true;
    systemAggregateAvailable: false;
    noteCountSubstitutionAllowed: false;
  };
  totalAmountPaid: {
    source: "prospectus_review.page2.paymasterTrackRecord.totalAmountPaid";
    isOfficerContent: true;
    systemAggregateAvailable: false;
    compactMoneyAllowed: false;
    futureMoneyFormatter: typeof PROSPECTUS_PAYMASTER_TRACK_RECORD_FUTURE_MONEY_FORMATTER;
  };
  successfulRepayment: {
    source: "prospectus_review.page2.paymasterTrackRecord.successfulRepaymentPercent";
    isOfficerContent: true;
    systemAggregateAvailable: false;
    issuerMetricReused: false;
  };
  onTimePayment: {
    source: "prospectus_review.page2.paymasterTrackRecord.onTimePaymentPercent";
    isOfficerContent: true;
    systemAggregateAvailable: false;
    issuerSixMonthMetricReused: false;
  };
  averagePaymentPeriod: {
    source: "prospectus_review.page2.paymasterTrackRecord.averagePaymentPeriodDays";
    isOfficerContent: true;
    systemAggregateAvailable: false;
  };
  snapshot: {
    sourceType: "officer_publication_content";
    systemHistoryAvailable: false;
  };
  claims: {
    generatedPositiveClaimAllowed: false;
  };
}

export const PROSPECTUS_PAYMASTER_TRACK_RECORD_AUDIT: ProspectusPaymasterTrackRecordAudit = {
  identity: {
    stableGroupingKeyAvailable: false,
    candidateKeys: [
      "notes.paymaster_snapshot.ssm_number",
      "notes.paymaster_snapshot.name",
    ],
    groupingDecision: "pending",
    nameGroupingApproved: false,
  },
  totalInvoicesPaid: {
    source: "prospectus_review.page2.paymasterTrackRecord.totalInvoicesPaid",
    isOfficerContent: true,
    systemAggregateAvailable: false,
    noteCountSubstitutionAllowed: false,
  },
  totalAmountPaid: {
    source: "prospectus_review.page2.paymasterTrackRecord.totalAmountPaid",
    isOfficerContent: true,
    systemAggregateAvailable: false,
    compactMoneyAllowed: false,
    futureMoneyFormatter: PROSPECTUS_PAYMASTER_TRACK_RECORD_FUTURE_MONEY_FORMATTER,
  },
  successfulRepayment: {
    source: "prospectus_review.page2.paymasterTrackRecord.successfulRepaymentPercent",
    isOfficerContent: true,
    systemAggregateAvailable: false,
    issuerMetricReused: false,
  },
  onTimePayment: {
    source: "prospectus_review.page2.paymasterTrackRecord.onTimePaymentPercent",
    isOfficerContent: true,
    systemAggregateAvailable: false,
    issuerSixMonthMetricReused: false,
  },
  averagePaymentPeriod: {
    source: "prospectus_review.page2.paymasterTrackRecord.averagePaymentPeriodDays",
    isOfficerContent: true,
    systemAggregateAvailable: false,
  },
  snapshot: {
    sourceType: "officer_publication_content",
    systemHistoryAvailable: false,
  },
  claims: {
    generatedPositiveClaimAllowed: false,
  },
};

/** Canva-facing fields only. */
export interface ProspectusPaymasterTrackRecord {
  sectionHeading: string;
  totalInvoicesPaid: string;
  totalAmountPaid: string;
  successfulRepaymentPercent: string;
  onTimePayment: string;
  averagePaymentPeriod: string;
  /** Audit/debug only — omitted from Canva HTML. */
  audit: ProspectusPaymasterTrackRecordAudit;
}

/**
 * Minimal optional context — observational only.
 * Canva-facing values must not depend on these inputs.
 */
export interface ProspectusPaymasterTrackRecordOfficerInputs {
  totalInvoicesPaid?: number | null;
  totalAmountPaid?: string | number | null;
  successfulRepaymentPercent?: string | number | null;
  onTimePaymentPercent?: string | number | null;
  averagePaymentPeriodDays?: string | number | null;
}

export interface ProspectusPaymasterTrackRecordInput {
  /** Prospectus-review officer-entered values only — never issuer metrics. */
  officerInputs?: ProspectusPaymasterTrackRecordOfficerInputs | null;
  paymasterSnapshot?: unknown;
  currentNoteId?: string | null;
  /** Observational — must not become Total Invoices Paid. */
  invoicePaidCount?: number | null;
  noteCount?: number | null;
  /** Observational amount candidates — must not become Total Amount Paid. */
  fundedAmount?: number | null;
  targetAmount?: number | null;
  invoiceFaceValue?: number | null;
  paymentTotal?: number | null;
  /** Observational issuer metric — must not become Successful Repayment. */
  issuerRepaidCount?: number | null;
  issuerArrearsCount?: number | null;
  issuerDefaultedCount?: number | null;
  issuerSuccessfulRepaymentPercent?: number | null;
  /** Observational issuer six-month rate — must not become On-Time Payment. */
  issuerOnTimePaymentPercent?: number | null;
  /** Observational dates — must not invent Average Payment Period. */
  invoiceDueDate?: Date | string | null;
  paymentReceivedDate?: Date | string | null;
  maturityDate?: Date | string | null;
  repaidAt?: Date | string | null;
  /** Observational grouping rows — must not trigger aggregates. */
  matchingPaymasterNameRows?: Array<{ name?: string | null; ssmNumber?: string | null }>;
}

export interface ProspectusPaymasterTrackRecordFieldSource {
  label: string;
  canonicalSource: string;
  availability: "static" | "stored" | "unresolved";
  surface: "canva" | "audit";
  possibleAlternatives: string;
  notes: string;
}

export const PROSPECTUS_PAYMASTER_TRACK_RECORD_FIELD_SOURCES: Record<
  | "sectionHeading"
  | "totalInvoicesPaid"
  | "totalAmountPaid"
  | "successfulRepaymentPercent"
  | "onTimePayment"
  | "averagePaymentPeriod",
  ProspectusPaymasterTrackRecordFieldSource
> = {
  sectionHeading: {
    label: "Section heading",
    canonicalSource: "static",
    availability: "static",
    surface: "canva",
    possibleAlternatives: "none",
    notes: "PAYMASTER TRACK RECORD",
  },
  totalInvoicesPaid: {
    label: "Total Invoices Paid",
    canonicalSource: "prospectus_review.page2.paymasterTrackRecord.totalInvoicesPaid",
    availability: "stored",
    surface: "canva",
    possibleAlternatives: "Note count; invoice submitted/funded counts — not used",
    notes: "Officer-entered. No system paymaster-history aggregate.",
  },
  totalAmountPaid: {
    label: "Total Amount Paid",
    canonicalSource: "prospectus_review.page2.paymasterTrackRecord.totalAmountPaid",
    availability: "stored",
    surface: "canva",
    possibleAlternatives:
      "funded_amount; target_amount; invoice face; trustee receipts — not used",
    notes:
      "Officer-entered. Display via formatProspectusMoneyMyr. Compact mil/million rejected.",
  },
  successfulRepaymentPercent: {
    label: "Successful Repayment",
    canonicalSource:
      "prospectus_review.page2.paymasterTrackRecord.successfulRepaymentPercent",
    availability: "stored",
    surface: "canva",
    possibleAlternatives:
      "Page 1 issuer REPAID/(REPAID+ARREARS+DEFAULTED) — not used (issuer grouping)",
    notes: "Officer-entered percent. Issuer metric must not be reused.",
  },
  onTimePayment: {
    label: "On-Time Payment",
    canonicalSource: "prospectus_review.page2.paymasterTrackRecord.onTimePaymentPercent",
    availability: "stored",
    surface: "canva",
    possibleAlternatives: "Page 1 issuer six-month on-time rate — not used",
    notes: "Officer-entered percent. No approved system timing definition.",
  },
  averagePaymentPeriod: {
    label: "Average Payment Period",
    canonicalSource:
      "prospectus_review.page2.paymasterTrackRecord.averagePaymentPeriodDays",
    availability: "stored",
    surface: "canva",
    possibleAlternatives: "repaid_at − due/maturity date math — not used",
    notes: "Officer-entered days. No approved system start/end formula.",
  },
};
