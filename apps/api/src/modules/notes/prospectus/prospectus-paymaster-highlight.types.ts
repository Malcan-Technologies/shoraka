/**
 * SECTION: Prospectus Page 1 — Paymaster Investor Highlight (DATA STAGE 5A)
 * WHY: Confirmed frozen name/entity only; no government/track-record/marketing claims
 */

import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

/** Claims that must not be generated without approval. */
export const PROSPECTUS_PAYMASTER_CLAIMS_REQUIRING_APPROVAL = [
  "strong",
  "government-backed",
  "strong payment track record",
  "reliable",
  "low-risk paymaster",
  "proven payer",
] as const;

export interface ProspectusPaymasterHighlightAudit {
  paymasterName: {
    source: "notes.paymaster_snapshot.name";
    isFrozen: true;
  };
  paymasterEntityType: {
    source: "notes.paymaster_snapshot.entity_type";
    isFrozen: true;
  };
  governmentClassification: {
    sourceStatus: "not_stored";
    inferenceAllowed: false;
    businessDecision: "pending";
  };
  paymentTrackRecord: {
    sourceStatus: "not_stored";
    inferenceAllowed: false;
    historicalDataAvailable: false;
  };
  highlightTitle: {
    sourceStatus: "not_stored";
    claimApprovalRequired: true;
  };
  highlightExplanation: {
    sourceStatus: "not_stored";
    claimApprovalRequired: true;
  };
  claimApproval: {
    status: "pending";
    requiredClaims: typeof PROSPECTUS_PAYMASTER_CLAIMS_REQUIRING_APPROVAL;
  };
}

export const PROSPECTUS_PAYMASTER_HIGHLIGHT_AUDIT: ProspectusPaymasterHighlightAudit = {
  paymasterName: {
    source: "notes.paymaster_snapshot.name",
    isFrozen: true,
  },
  paymasterEntityType: {
    source: "notes.paymaster_snapshot.entity_type",
    isFrozen: true,
  },
  governmentClassification: {
    sourceStatus: "not_stored",
    inferenceAllowed: false,
    businessDecision: "pending",
  },
  paymentTrackRecord: {
    sourceStatus: "not_stored",
    inferenceAllowed: false,
    historicalDataAvailable: false,
  },
  highlightTitle: {
    sourceStatus: "not_stored",
    claimApprovalRequired: true,
  },
  highlightExplanation: {
    sourceStatus: "not_stored",
    claimApprovalRequired: true,
  },
  claimApproval: {
    status: "pending",
    requiredClaims: PROSPECTUS_PAYMASTER_CLAIMS_REQUIRING_APPROVAL,
  },
};

/** Canva-facing highlight fields only. */
export interface ProspectusPaymasterHighlight {
  paymasterName: string;
  paymasterEntityType: string;
  governmentClassification: string;
  paymasterPaymentTrackRecord: string;
  highlightTitle: string;
  highlightExplanation: string;
  /** Audit/debug only — omitted from Canva HTML. */
  audit: ProspectusPaymasterHighlightAudit;
}

/**
 * Raw inputs for preview/builder — not Prisma.
 * Optional Note repayment observations prove track-record is still DNA.
 */
export interface ProspectusPaymasterHighlightInput {
  /** notes.paymaster_snapshot.name */
  paymasterName: string | null | undefined;
  /** notes.paymaster_snapshot.entity_type */
  paymasterEntityType: string | null | undefined;
  /**
   * Observational only — current Note repayment/status must not invent paymaster history.
   */
  noteRepaymentObserved?: {
    noteStatus?: string | null;
    repaidAt?: Date | string | null;
    receivedPayoutAmount?: number | null;
  };
}

export interface ProspectusPaymasterHighlightFieldSource {
  label: string;
  canonicalSource: string;
  availability: "stored" | "unresolved";
  surface: "canva" | "audit";
  possibleAlternatives: string;
  notes: string;
}

export const PROSPECTUS_PAYMASTER_HIGHLIGHT_FIELD_SOURCES: Record<
  | "paymasterName"
  | "paymasterEntityType"
  | "governmentClassification"
  | "paymasterPaymentTrackRecord"
  | "highlightTitle"
  | "highlightExplanation",
  ProspectusPaymasterHighlightFieldSource
> = {
  paymasterName: {
    label: "Paymaster Name",
    canonicalSource: "notes.paymaster_snapshot.name",
    availability: "stored",
    surface: "canva",
    possibleAlternatives: "live Contract.customer_details.name — not used",
    notes: "Reuse Stage 2 buildProspectusDatesPaymaster. Frozen on Note.",
  },
  paymasterEntityType: {
    label: "Paymaster Entity Type",
    canonicalSource: "notes.paymaster_snapshot.entity_type",
    availability: "stored",
    surface: "canva",
    possibleAlternatives: "live Contract.customer_details.entity_type — not used",
    notes:
      "Reuse Stage 2. Preserve display-ready ENTITY_TYPES label exactly (no shortening).",
  },
  governmentClassification: {
    label: "Government Classification",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives:
      "Infer from entity_type; isGovernmentEntityType helper — not used",
    notes: "No approved government vs non-government mapping. inferenceAllowed = false.",
  },
  paymasterPaymentTrackRecord: {
    label: "Paymaster Payment Track Record",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives:
      "Current Note repayments; issuer history; CTOS; RegTank — not used",
    notes:
      "No paymaster history model. Note repayments are Note-specific. historicalDataAvailable = false.",
  },
  highlightTitle: {
    label: "Highlight Title",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives:
      "Canva \"Backed by a strong government paymaster\"; auto from entity_type — not used",
    notes: "claimApprovalRequired = true. Do not generate marketing title.",
  },
  highlightExplanation: {
    label: "Highlight Explanation",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives:
      "Template name + entity + track record; Canva sample — not used",
    notes: "claimApprovalRequired = true. Do not compose explanation from confirmed fields.",
  },
};
