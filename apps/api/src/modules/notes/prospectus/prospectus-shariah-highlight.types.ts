/**
 * SECTION: Prospectus Page 1 — Shariah Investor Highlight (DATA STAGE 5D)
 * WHY: No Note-level compliance claim; reuse Stage 4C principle DNA; Tawarruq ≠ evidence
 */

import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";
import type { ProspectusPaymentBasisShariahInput } from "./prospectus-payment-basis-shariah.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

export const PROSPECTUS_SHARIAH_CLAIMS_REQUIRING_APPROVAL = [
  "Shariah-compliant",
  "specific principle wording",
  "Shariah structure wording",
  "adviser or committee references",
  "Tawarruq as legal evidence",
  "transparent underlying transaction",
  "approved structure",
  "certification claims",
] as const;

export interface ProspectusShariahHighlightAudit {
  shariahCompliantStatus: {
    sourceStatus: "not_stored";
    inferenceAllowed: false;
    productLevelStatusAvailable: false;
    noteLevelStatusAvailable: false;
  };
  shariahPrinciple: {
    sourceStatus: "not_stored";
    reusedFromStage4C: true;
    inferenceAllowed: false;
  };
  tawarruq: {
    operationalFlowExists: true;
    usedAsEvidence: false;
    legalInterpretationAllowed: false;
  };
  adviserApproval: {
    adviserReferenceAvailable: false;
    committeeApprovalAvailable: false;
    certificateAvailable: false;
  };
  highlight: {
    claimApprovalRequired: true;
    approvedCopyAvailable: false;
  };
  snapshot: {
    isFrozen: false;
    snapshotDecision: "pending";
  };
  claimApproval: {
    status: "pending";
    requiredClaims: typeof PROSPECTUS_SHARIAH_CLAIMS_REQUIRING_APPROVAL;
  };
}

export const PROSPECTUS_SHARIAH_HIGHLIGHT_AUDIT: ProspectusShariahHighlightAudit = {
  shariahCompliantStatus: {
    sourceStatus: "not_stored",
    inferenceAllowed: false,
    productLevelStatusAvailable: false,
    noteLevelStatusAvailable: false,
  },
  shariahPrinciple: {
    sourceStatus: "not_stored",
    reusedFromStage4C: true,
    inferenceAllowed: false,
  },
  tawarruq: {
    operationalFlowExists: true,
    usedAsEvidence: false,
    legalInterpretationAllowed: false,
  },
  adviserApproval: {
    adviserReferenceAvailable: false,
    committeeApprovalAvailable: false,
    certificateAvailable: false,
  },
  highlight: {
    claimApprovalRequired: true,
    approvedCopyAvailable: false,
  },
  snapshot: {
    isFrozen: false,
    snapshotDecision: "pending",
  },
  claimApproval: {
    status: "pending",
    requiredClaims: PROSPECTUS_SHARIAH_CLAIMS_REQUIRING_APPROVAL,
  },
};

/** Canva-facing highlight fields only. */
export interface ProspectusShariahHighlight {
  shariahCompliantStatus: string;
  /** Reuses Stage 4C shariahPrinciple (kept name for Stage 4C dependent tests). */
  specificShariahPrinciple: string;
  evidenceSource: string;
  approvalOrAdviserReference: string;
  highlightTitle: string;
  highlightExplanation: string;
  /** Audit/debug only — omitted from Canva HTML. */
  audit: ProspectusShariahHighlightAudit;
}

/**
 * Optional observational inputs prove Tawarruq/marketing never become Canva values.
 * Compatible with Stage 4C observational input (passed through for principle reuse).
 */
export type ProspectusShariahHighlightInput = ProspectusPaymentBasisShariahInput & {
  /** Observational Shoraka STP status — must not become Canva-facing evidence. */
  shorakaStatus?: string | null;
};

export interface ProspectusShariahHighlightFieldSource {
  label: string;
  canonicalSource: string;
  availability: "unresolved";
  surface: "canva" | "audit";
  possibleAlternatives: string;
  notes: string;
}

export const PROSPECTUS_SHARIAH_HIGHLIGHT_FIELD_SOURCES: Record<
  | "shariahCompliantStatus"
  | "specificShariahPrinciple"
  | "evidenceSource"
  | "approvalOrAdviserReference"
  | "highlightTitle"
  | "highlightExplanation",
  ProspectusShariahHighlightFieldSource
> = {
  shariahCompliantStatus: {
    label: "Shariah-Compliant Status",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives:
      "Landing \"Shariah Compliant\"; Product boolean; compliance_declaration — not used",
    notes:
      "No Product/Note structured status. Platform marketing ≠ Note prospectus status. inferenceAllowed = false.",
  },
  specificShariahPrinciple: {
    label: "Shariah Principle",
    canonicalSource: "Stage 4C buildProspectusPaymentBasisShariah.shariahPrinciple",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives: "Canva Bai' Al-Dayn Bi Al-Sila'; Tawarruq label — not used",
    notes: "Reuse Stage 4C only. No second principle resolver. reusedFromStage4C = true.",
  },
  evidenceSource: {
    label: "Evidence Source",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives:
      "Tawarruq/Shoraka ops; commodity_type; murabaha_amount; marketing — not used",
    notes: "Tawarruq usedAsEvidence = false. Operational flow ≠ legal prospectus evidence.",
  },
  approvalOrAdviserReference: {
    label: "Adviser or Approval Reference",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives:
      "Adviser name; committee approval; certificate; opinion reference — not in schema",
    notes: "adviserReferenceAvailable / committeeApprovalAvailable / certificateAvailable = false.",
  },
  highlightTitle: {
    label: "Highlight Title",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives: "Canva \"Shariah-compliant investment\" — not used",
    notes: "claimApprovalRequired = true. Do not hardcode marketing titles.",
  },
  highlightExplanation: {
    label: "Highlight Explanation",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    surface: "canva",
    possibleAlternatives:
      "Canva Bai' / transparent underlying transaction copy — not used",
    notes: "approvedCopyAvailable = false. Do not generate structure/adviser sentences.",
  },
};
