/**
 * SECTION: Prospectus Page 2 — About the Invoice / Work Performed (DATA STAGE 6)
 * WHY: DNA-first — four factual/legal claims; no inference from contract/invoice/DOA presence
 */

import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

/** Static Canva section title — not a database field. */
export const PROSPECTUS_INVOICE_WORK_NARRATIVE_SECTION_HEADING =
  "ABOUT THE INVOICE / WORK PERFORMED";

export interface ProspectusInvoiceWorkNarrativeAudit {
  workUnderContract: {
    status: "unresolved";
    contractSnapshotAvailable: "observational_only";
    workCompletionEvidenceRequired: true;
    inferenceAllowed: false;
    approvedNarrativeAvailable: false;
  };
  certificationAcceptance: {
    status: "unresolved";
    invoiceDocumentAvailable: "observational_only";
    certificationEvidenceRequired: true;
    paymasterAcceptanceEvidenceRequired: true;
    inferenceAllowed: false;
  };
  paymasterTrustAccount: {
    status: "unresolved";
    trusteeWorkflowAvailable: "operational_context_only";
    legalPaymentInstructionRequired: true;
    dueDatePromiseAllowed: false;
    inferenceAllowed: false;
  };
  deedOfAssignment: {
    status: "unresolved";
    uploadSlotOrDocumentIsProof: false;
    executedStatusRequired: true;
    verificationRequired: true;
    inferenceAllowed: false;
  };
  snapshot: {
    sourceType: "unavailable_approved_invoice_narrative";
    isFrozen: false;
    snapshotDecision: "pending_legal_and_product_approval";
  };
  claims: {
    generatedLegalClaimAllowed: false;
    generatedFactualClaimAllowed: false;
    adminApprovedFrozenTextPreferred: true;
  };
}

export const PROSPECTUS_INVOICE_WORK_NARRATIVE_AUDIT: ProspectusInvoiceWorkNarrativeAudit = {
  workUnderContract: {
    status: "unresolved",
    contractSnapshotAvailable: "observational_only",
    workCompletionEvidenceRequired: true,
    inferenceAllowed: false,
    approvedNarrativeAvailable: false,
  },
  certificationAcceptance: {
    status: "unresolved",
    invoiceDocumentAvailable: "observational_only",
    certificationEvidenceRequired: true,
    paymasterAcceptanceEvidenceRequired: true,
    inferenceAllowed: false,
  },
  paymasterTrustAccount: {
    status: "unresolved",
    trusteeWorkflowAvailable: "operational_context_only",
    legalPaymentInstructionRequired: true,
    dueDatePromiseAllowed: false,
    inferenceAllowed: false,
  },
  deedOfAssignment: {
    status: "unresolved",
    uploadSlotOrDocumentIsProof: false,
    executedStatusRequired: true,
    verificationRequired: true,
    inferenceAllowed: false,
  },
  snapshot: {
    sourceType: "unavailable_approved_invoice_narrative",
    isFrozen: false,
    snapshotDecision: "pending_legal_and_product_approval",
  },
  claims: {
    generatedLegalClaimAllowed: false,
    generatedFactualClaimAllowed: false,
    adminApprovedFrozenTextPreferred: true,
  },
};

/** Canva-facing fields only. */
export interface ProspectusInvoiceWorkNarrative {
  sectionHeading: string;
  workUnderContractStatement: string;
  certificationAcceptanceStatement: string;
  paymasterTrustAccountStatement: string;
  deedOfAssignmentStatement: string;
  /** Statement keys with isVisible=false — not rendered. */
  omittedStatements: string[];
  /** Audit/debug only — omitted from Canva HTML. */
  audit: ProspectusInvoiceWorkNarrativeAudit;
}

/**
 * Minimal optional context — observational only.
 * Canva-facing values must not depend on these inputs.
 * Future approved frozen statements are not accepted or used yet.
 */
export interface ProspectusInvoiceWorkNarrativeInput {
  /**
   * Optional typed officer/placeholder statements.
   * Production Prisma path leaves this undefined → DNA.
   */
  invoiceWorkStatements?: Array<{
    key: string;
    text: string;
    isVisible: boolean;
    sourceType: "placeholder_manual" | "derived_suggestion" | "fixed_template";
  }>;
  contractSnapshot?: unknown;
  invoiceSnapshot?: unknown;
  paymasterSnapshot?: unknown;
  supportingDocuments?: unknown;
  trusteeContext?: unknown;
  /** Observational Application / contract free text — not legal proof. */
  applicationWorkDescription?: string | null;
  invoiceDocument?: unknown;
  invoiceStatus?: string | null;
  noteStatus?: string | null;
  adminApprovalStatus?: string | null;
  maturityDate?: string | null;
  productConfigurationText?: string | null;
  doaUploadSlot?: unknown;
  doaDocument?: unknown;
  financingType?: string | null;
}

export interface ProspectusInvoiceWorkNarrativeFieldSource {
  label: string;
  canonicalSource: string;
  availability: "static" | "unresolved";
  surface: "canva" | "audit";
  possibleAlternatives: string;
  notes: string;
}

export const PROSPECTUS_INVOICE_WORK_NARRATIVE_FIELD_SOURCES: Record<
  | "sectionHeading"
  | "workUnderContractStatement"
  | "certificationAcceptanceStatement"
  | "paymasterTrustAccountStatement"
  | "deedOfAssignmentStatement",
  ProspectusInvoiceWorkNarrativeFieldSource
> = {
  sectionHeading: {
    label: "Section heading",
    canonicalSource: "static",
    availability: "static",
    surface: "canva",
    possibleAlternatives: "none",
    notes: "ABOUT THE INVOICE / WORK PERFORMED",
  },
  workUnderContractStatement: {
    label: "Work Under Contract Statement",
    canonicalSource: "page2.aboutInvoice.items",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives:
      "contract_snapshot; Application contract text — not proof of completed work",
    notes:
      "Officer-edited free text (KIH pattern). System suggestions are templates only until Ops confirms.",
  },
  certificationAcceptanceStatement: {
    label: "Certification and Acceptance Statement",
    canonicalSource: "page2.aboutInvoice.items",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives:
      "invoice document; invoice/Note status; paymaster snapshot — not proof of certification",
    notes:
      "Officer-edited free text (KIH pattern). System suggestions are templates only until Ops confirms.",
  },
  paymasterTrustAccountStatement: {
    label: "Paymaster-to-Trust-Account Statement",
    canonicalSource: "page2.aboutInvoice.items",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives:
      "trustee workflow; maturity; product config — not a legal payment instruction",
    notes:
      "Officer-edited free text (KIH pattern). System suggestions are templates only until Ops confirms.",
  },
  deedOfAssignmentStatement: {
    label: "Deed of Assignment Statement",
    canonicalSource: "page2.aboutInvoice.items",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives:
      "DOA upload slot/file; financing type — not proof of executed assignment",
    notes:
      "Officer-edited free text (KIH pattern). System suggestions are templates only until Ops confirms.",
  },
};
