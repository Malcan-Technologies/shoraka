/**
 * SECTION: Prospectus Page 1 — Paymaster Investor Highlight (DATA STAGE 5A)
 * WHY: First KEY INVESTOR HIGHLIGHTS item; only confirmed snapshot fields are safe
 */

import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

export interface ProspectusPaymasterHighlight {
  paymasterName: string;
  paymasterEntityType: string;
  governmentClassification: string;
  paymasterPaymentTrackRecord: string;
  highlightTitle: string;
  highlightExplanation: string;
  claimApprovalStatus: string;
}

/** Raw inputs for preview/builder — not Prisma. */
export interface ProspectusPaymasterHighlightInput {
  /** notes.paymaster_snapshot.name */
  paymasterName: string | null | undefined;
  /** notes.paymaster_snapshot.entity_type */
  paymasterEntityType: string | null | undefined;
}

export interface ProspectusPaymasterHighlightFieldSource {
  label: string;
  canonicalSource: string;
  availability: "stored" | "unresolved";
  possibleAlternatives: string;
  notes: string;
}

export const PROSPECTUS_PAYMASTER_HIGHLIGHT_FIELD_SOURCES: Record<
  keyof ProspectusPaymasterHighlight,
  ProspectusPaymasterHighlightFieldSource
> = {
  paymasterName: {
    label: "Paymaster name",
    canonicalSource: "notes.paymaster_snapshot.name",
    availability: "stored",
    possibleAlternatives: "live Contract.customer_details.name — not used",
    notes: "Same frozen snapshot field as Stage 2. Written at note create from contract customer_details.",
  },
  paymasterEntityType: {
    label: "Paymaster entity type",
    canonicalSource: "notes.paymaster_snapshot.entity_type",
    availability: "stored",
    possibleAlternatives: "live Contract.customer_details.entity_type — not used",
    notes:
      "Display-ready issuer ENTITY_TYPES labels (e.g. Federal Government Agency). No formatting helper.",
  },
  governmentClassification: {
    label: "Government classification",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    possibleAlternatives:
      "Infer from entity_type containing \"Government\"; invent government/private/public helper — not used",
    notes: "No existing classifier in code. Do not invent one for prospectus.",
  },
  paymasterPaymentTrackRecord: {
    label: "Paymaster payment track record",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    possibleAlternatives:
      "Note repayment receipts (this note only); issuer repayment history; CTOS (issuer people) — not used",
    notes:
      "No paymaster payment history %, rating, grade, or confidence model. Entity type ≠ track record.",
  },
  highlightTitle: {
    label: "Highlight title",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    possibleAlternatives:
      "Hardcode Canva \"Backed by a strong government paymaster\"; auto-generate from entity_type — not used",
    notes:
      "No stored highlight. \"Strong government\" claim needs classification + approval; unsupported.",
  },
  highlightExplanation: {
    label: "Highlight explanation",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    possibleAlternatives:
      "Template with name + entity_type + invented track-record sentence; admin free text — not used",
    notes:
      "No stored explanation helper. Do not generate \"strong payment track record\" wording.",
  },
  claimApprovalStatus: {
    label: "Claim approval status",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    possibleAlternatives: "Admin/legal/compliance prospectus approval workflow — does not exist",
    notes:
      "Positive marketing claims (strong / government-backed / track record) need risk/compliance/legal or admin confirmation.",
  },
};
