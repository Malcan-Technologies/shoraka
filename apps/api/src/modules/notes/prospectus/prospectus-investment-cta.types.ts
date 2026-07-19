/**
 * SECTION: Prospectus Page 2 — Investment CTA (DATA STAGE 8)
 * WHY: Static heading/button; paragraph DNA; route only via confirmed investor path
 */

import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

export const PROSPECTUS_INVESTMENT_CTA_SECTION_HEADING = "INVEST WITH CONFIDENCE";
export const PROSPECTUS_INVESTMENT_CTA_BUTTON_LABEL = "INVEST NOW";

/** Closest current prospectus wording pattern: "Minimum Investment: {money}". */
export const PROSPECTUS_MINIMUM_INVESTMENT_STATEMENT_PREFIX = "Minimum investment:";

export interface ProspectusInvestmentCtaAudit {
  heading: {
    sourceType: "static_canva_section_heading";
  };
  paragraph: {
    status: "unresolved";
    approvedCopyAvailable: false;
    generatedMarketingClaimAllowed: false;
  };
  button: {
    labelSource: "static_template";
    destinationRouteSource: "confirmed_existing_route" | "unavailable";
    arbitraryUrlAllowed: false;
    investabilityRuleOwnedByMarketplace: true;
  };
  minimumInvestment: {
    source: "MARKETPLACE_MIN_COMMIT_MYR";
    formatter: "formatProspectusMoneyMyr";
    capacityAdjustedMinimumUsed: false;
  };
  claims: {
    attractiveReturnAllowed: false;
    shortTermClaimAllowed: false;
    shariahCompliantInvestmentClaimAllowed: false;
  };
}

export interface ProspectusInvestmentCta {
  sectionHeading: string;
  paragraph: string;
  buttonLabel: string;
  /** Confirmed internal path only — never shown as visible Canva text. */
  buttonHref: string | null;
  isButtonEnabled: boolean;
  minimumInvestmentStatement: string;
  audit: ProspectusInvestmentCtaAudit;
}

/**
 * Prefer Note id; optional prebuilt path only if it matches /investments/{noteId}.
 * Do not accept arbitrary external URLs.
 */
export interface ProspectusInvestmentCtaInput {
  /** notes.id — used with buildProspectusInvestorNoteInvestmentPath */
  noteId?: string | null;
  /** Only accepted when it matches the confirmed investor Note path. */
  investmentDestinationUrl?: string | null;
  /** Observational marketing/product signals — must not become CTA copy. */
  productNameEndingInI?: string | null;
  marketingParagraph?: string | null;
}

export interface ProspectusInvestmentCtaFieldSource {
  label: string;
  canonicalSource: string;
  availability: "static" | "unresolved" | "validated";
  surface: "canva" | "audit";
  notes: string;
}

export const PROSPECTUS_INVESTMENT_CTA_FIELD_SOURCES: Record<
  | "sectionHeading"
  | "paragraph"
  | "buttonLabel"
  | "buttonHref"
  | "minimumInvestmentStatement",
  ProspectusInvestmentCtaFieldSource
> = {
  sectionHeading: {
    label: "Section heading",
    canonicalSource: "static",
    availability: "static",
    surface: "canva",
    notes: "INVEST WITH CONFIDENCE — heading only; not a claim generator",
  },
  paragraph: {
    label: "CTA Paragraph",
    canonicalSource: "none",
    availability: "unresolved",
    surface: "canva",
    notes: "No approved marketing/legal copy. Canva attractive/short-term/Shariah claims rejected.",
  },
  buttonLabel: {
    label: "CTA Button Label",
    canonicalSource: "static",
    availability: "static",
    surface: "canva",
    notes: "INVEST NOW — does not prove investability",
  },
  buttonHref: {
    label: "CTA Destination",
    canonicalSource: "/investments/{notes.id}",
    availability: "validated",
    surface: "audit",
    notes:
      "Confirmed investor route. Auth required in investor portal. Investability owned by marketplace.",
  },
  minimumInvestmentStatement: {
    label: "Minimum Investment Statement",
    canonicalSource: "MARKETPLACE_MIN_COMMIT_MYR",
    availability: "static",
    surface: "canva",
    notes: "formatProspectusMoneyMyr only. Not capacity-adjusted minCommit.",
  },
};
