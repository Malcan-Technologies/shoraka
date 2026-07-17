/**
 * SECTION: Prospectus Page 1 — Shariah Investor Highlight (DATA STAGE 5D)
 * WHY: Fourth KEY INVESTOR HIGHLIGHTS item; broader compliance claim ≠ Stage 4C principle
 */

import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

export interface ProspectusShariahHighlight {
  shariahCompliantStatus: string;
  specificShariahPrinciple: string;
  evidenceSource: string;
  approvalOrAdviserReference: string;
  highlightTitle: string;
  highlightExplanation: string;
  claimApprovalStatus: string;
  frozenOnNote: string;
}

/**
 * No confirmed raw inputs — builder returns unresolved / constant No for frozen.
 */
export type ProspectusShariahHighlightInput = Record<string, never>;

export interface ProspectusShariahHighlightFieldSource {
  label: string;
  canonicalSource: string;
  availability: "unresolved" | "constant";
  possibleAlternatives: string;
  notes: string;
}

export const PROSPECTUS_SHARIAH_HIGHLIGHT_FIELD_SOURCES: Record<
  keyof ProspectusShariahHighlight,
  ProspectusShariahHighlightFieldSource
> = {
  shariahCompliantStatus: {
    label: "Shariah-compliant status",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    possibleAlternatives:
      "Landing \"Shariah Compliant\" / signup modal; POC complianceBadge; invent Product boolean — not used",
    notes:
      "No shariah_compliant / is_shariah field on Product, Note, Application, or snapshots. Platform marketing ≠ Note-level status.",
  },
  specificShariahPrinciple: {
    label: "Specific Shariah principle",
    canonicalSource: "none confirmed (same as Stage 4C)",
    availability: "unresolved",
    possibleAlternatives: "Canva Bai' Al-Dayn Bi Al-Sila'; Tawarruq label — not used",
    notes: "Unresolved in Stage 4C. Reused here as DNA; not a second principle source.",
  },
  evidenceSource: {
    label: "Evidence source",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    possibleAlternatives:
      "Shoraka Tawarruq certificate; landing marketing; issuer Shariah screening notice — not used as Note prospectus evidence",
    notes:
      "Tawarruq STP proves a commodity-trade operational step before disbursement, not an approved investor-facing compliance statement for the Note.",
  },
  approvalOrAdviserReference: {
    label: "Approval or adviser reference",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    possibleAlternatives:
      "Shariah adviser name; committee approval; opinion/certificate reference — not in schema",
    notes: "Docs mention pending Shariah advisor confirmation for some STP rules; no stored adviser/opinion fields.",
  },
  highlightTitle: {
    label: "Highlight title",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    possibleAlternatives: "Hardcode Canva \"Shariah-compliant investment\" — not used",
    notes: "No stored approved Note prospectus title. Do not hardcode marketing copy.",
  },
  highlightExplanation: {
    label: "Highlight explanation",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    possibleAlternatives:
      "Canva \"structured in accordance…\" / \"transparent underlying transaction\" — not used",
    notes: "No approved Note-level explanation. Investor portal has no Shariah highlight copy.",
  },
  claimApprovalStatus: {
    label: "Claim approval status",
    canonicalSource: "none confirmed",
    availability: "unresolved",
    possibleAlternatives: "Legal / compliance / Shariah-adviser prospectus claim workflow — missing",
    notes:
      "Investor-facing Shariah-compliant claims need legal, compliance, and/or Shariah-adviser approval.",
  },
  frozenOnNote: {
    label: "Frozen on Note",
    canonicalSource: "notes product/paymaster/issuer/invoice snapshots (no Shariah fields)",
    availability: "constant",
    possibleAlternatives: "Freeze compliance status or principle onto Note — not implemented",
    notes: "No Shariah status or principle is stored or frozen on the Note.",
  },
};
