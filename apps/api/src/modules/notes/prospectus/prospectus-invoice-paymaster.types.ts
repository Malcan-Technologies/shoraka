/**
 * SECTION: Prospectus Page 2 — Invoice & Paymaster Information (DATA STAGE 2)
 * WHY: Frozen face value / maturity / paymaster; DOA / rating / confidence are officer content
 */

import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

/** Static Canva section title — not a database field. */
export const PROSPECTUS_INVOICE_PAYMASTER_SECTION_HEADING =
  "INVOICE & PAYMASTER INFORMATION";

export interface ProspectusInvoicePaymasterAudit {
  invoiceAmount: {
    source: "notes.invoice_snapshot.details.value";
    meaning: "invoice_face_value";
    isFrozen: true;
  };
  invoiceDueDate: {
    source: "notes.maturity_date";
    sourceAtCreate: "invoice.details.maturity_date";
    isFrozen: true;
  };
  paymaster: {
    source: "notes.paymaster_snapshot.name";
    isFrozen: true;
  };
  paymasterNature: {
    source: "notes.paymaster_snapshot.entity_type";
    displayMapping: "none";
    fullStoredValuePreserved: true;
    isFrozen: true;
  };
  deedOfAssignment: {
    source: "prospectus_review.page2.invoicePaymaster.deedOfAssignment";
    isOfficerContent: true;
    requiredForApproval: true;
    inferenceAllowed: false;
    allowedValues: ["Yes", "No"];
  };
  paymasterRating: {
    source: "prospectus_review.page2.invoicePaymaster.paymasterRating";
    isOfficerContent: true;
    requiredForApproval: true;
    inferenceAllowed: false;
    allowedValues: ["PM1", "PM2", "PM3", "PM4"];
  };
  confidenceGrading: {
    source: "prospectus_review.page2.invoicePaymaster.confidenceGrading";
    isOfficerContent: true;
    requiredForApproval: true;
    inferenceAllowed: false;
    allowedValues: ["High", "Medium", "Low"];
  };
  snapshot: {
    sourceType: "note_creation_snapshots";
    liveFallbackAllowed: false;
  };
}

export const PROSPECTUS_INVOICE_PAYMASTER_AUDIT: ProspectusInvoicePaymasterAudit = {
  invoiceAmount: {
    source: "notes.invoice_snapshot.details.value",
    meaning: "invoice_face_value",
    isFrozen: true,
  },
  invoiceDueDate: {
    source: "notes.maturity_date",
    sourceAtCreate: "invoice.details.maturity_date",
    isFrozen: true,
  },
  paymaster: {
    source: "notes.paymaster_snapshot.name",
    isFrozen: true,
  },
  paymasterNature: {
    source: "notes.paymaster_snapshot.entity_type",
    displayMapping: "none",
    fullStoredValuePreserved: true,
    isFrozen: true,
  },
  deedOfAssignment: {
    source: "prospectus_review.page2.invoicePaymaster.deedOfAssignment",
    isOfficerContent: true,
    requiredForApproval: true,
    inferenceAllowed: false,
    allowedValues: ["Yes", "No"],
  },
  paymasterRating: {
    source: "prospectus_review.page2.invoicePaymaster.paymasterRating",
    isOfficerContent: true,
    requiredForApproval: true,
    inferenceAllowed: false,
    allowedValues: ["PM1", "PM2", "PM3", "PM4"],
  },
  confidenceGrading: {
    source: "prospectus_review.page2.invoicePaymaster.confidenceGrading",
    isOfficerContent: true,
    requiredForApproval: true,
    inferenceAllowed: false,
    allowedValues: ["High", "Medium", "Low"],
  },
  snapshot: {
    sourceType: "note_creation_snapshots",
    liveFallbackAllowed: false,
  },
};

/** Canva-facing fields only. */
export interface ProspectusInvoicePaymaster {
  sectionHeading: string;
  invoiceAmount: string;
  invoiceDueDate: string;
  paymasterName: string;
  paymasterNature: string;
  deedOfAssignment: string;
  paymasterRating: string;
  confidenceGrading: string;
  /** Audit/debug only — omitted from Canva HTML. */
  audit: ProspectusInvoicePaymasterAudit;
}

/**
 * Raw inputs for preview/builder — not Prisma.
 * Observational fields prove target/funded/live invoice/docs are never used.
 */
export interface ProspectusInvoicePaymasterInput {
  /** notes.invoice_snapshot (JSON) */
  invoiceSnapshot?: unknown;
  /** notes.maturity_date */
  maturityDate?: Date | string | null;
  /** notes.paymaster_snapshot (JSON) */
  paymasterSnapshot?: unknown;
  /** Observational — must not become Invoice Amount. */
  targetAmount?: number | null;
  /** Observational — must not become Invoice Amount. */
  fundedAmount?: number | null;
  /** Observational live invoice maturity — must not replace notes.maturity_date. */
  liveInvoiceMaturityDate?: Date | string | null;
  /** Observational supporting docs / DOA upload — must not infer Yes. */
  supportingDocuments?: unknown;
  /** Officer-selected DOA from Prospectus review publication content. */
  officerDeedOfAssignment?: string | null;
  /** Officer-selected Paymaster Rating from Prospectus review publication content. */
  officerPaymasterRating?: string | null;
  /** Officer-selected Confidence Grading from Prospectus review publication content. */
  officerConfidenceGrading?: string | null;
}

export interface ProspectusInvoicePaymasterFieldSource {
  label: string;
  canonicalSource: string;
  availability: "static" | "stored" | "unresolved";
  surface: "canva" | "audit";
  possibleAlternatives: string;
  notes: string;
}

export const PROSPECTUS_INVOICE_PAYMASTER_FIELD_SOURCES: Record<
  | "sectionHeading"
  | "invoiceAmount"
  | "invoiceDueDate"
  | "paymasterName"
  | "paymasterNature"
  | "deedOfAssignment"
  | "paymasterRating"
  | "confidenceGrading",
  ProspectusInvoicePaymasterFieldSource
> = {
  sectionHeading: {
    label: "Section heading",
    canonicalSource: "static",
    availability: "static",
    surface: "canva",
    possibleAlternatives: "none",
    notes: "INVOICE & PAYMASTER INFORMATION",
  },
  invoiceAmount: {
    label: "Invoice Amount",
    canonicalSource: "notes.invoice_snapshot.details.value",
    availability: "stored",
    surface: "canva",
    possibleAlternatives:
      "notes.target_amount; notes.funded_amount; requested_amount; details.invoice_value aliases — not used",
    notes: "Original invoice face value. formatProspectusMoneyMyr only. No compact money.",
  },
  invoiceDueDate: {
    label: "Invoice Due Date",
    canonicalSource: "notes.maturity_date",
    availability: "stored",
    surface: "canva",
    possibleAlternatives:
      "live Invoice.details.maturity_date; listing closes_at; repaid_at — not used",
    notes: "Copied from invoice maturity at Note create. formatProspectusDateUtc. No live fallback.",
  },
  paymasterName: {
    label: "Paymaster",
    canonicalSource: "notes.paymaster_snapshot.name",
    availability: "stored",
    surface: "canva",
    possibleAlternatives: "live Contract.customer_details — not used",
    notes: "Frozen at Note create. No name aliases.",
  },
  paymasterNature: {
    label: "Nature of Paymaster",
    canonicalSource: "notes.paymaster_snapshot.entity_type",
    availability: "stored",
    surface: "canva",
    possibleAlternatives: "short Government mapping — not used",
    notes: "Full stored ENTITY_TYPES value preserved. No Page 2 shortening.",
  },
  deedOfAssignment: {
    label: "Deed of Assignment (DOA)",
    canonicalSource: "prospectus_review.page2.invoicePaymaster.deedOfAssignment",
    availability: "stored",
    surface: "canva",
    possibleAlternatives:
      "supporting_documents upload slot; product type; trustee workflow — not used",
    notes: "Required officer select for approval: Yes | No. DNA when unset (old snapshots).",
  },
  paymasterRating: {
    label: "Paymaster Rating",
    canonicalSource: "prospectus_review.page2.invoicePaymaster.paymasterRating",
    availability: "stored",
    surface: "canva",
    possibleAlternatives: "SoukScore; CTOS; live Contract — not used",
    notes: "Required officer select for approval: PM1 | PM2 | PM3 | PM4. DNA when unset.",
  },
  confidenceGrading: {
    label: "Confidence Grading",
    canonicalSource: "prospectus_review.page2.invoicePaymaster.confidenceGrading",
    availability: "stored",
    surface: "canva",
    possibleAlternatives: "CTOS; live Contract — not used",
    notes: "Required officer select for approval: High | Medium | Low. DNA when unset.",
  },
};
