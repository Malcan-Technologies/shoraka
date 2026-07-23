/**
 * SECTION: Prospectus Page 2 — Investment CTA (DATA STAGE 8)
 * WHY: Static frozen wording + non-clickable button; live invest stays on marketplace
 */

import { PROSPECTUS_INVEST_CTA_DESCRIPTION } from "./prospectus-static-copy";

export const PROSPECTUS_INVESTMENT_CTA_SECTION_HEADING = "INVEST WITH CONFIDENCE";
export const PROSPECTUS_INVESTMENT_CTA_BUTTON_LABEL = "INVEST NOW";
/** Re-export shared static CTA description — do not duplicate the sentence elsewhere. */
export { PROSPECTUS_INVEST_CTA_DESCRIPTION as PROSPECTUS_INVESTMENT_CTA_DESCRIPTION };

/** Closest current prospectus wording pattern: "Minimum investment: {money}". */
export const PROSPECTUS_MINIMUM_INVESTMENT_STATEMENT_PREFIX = "Minimum investment:";

export interface ProspectusInvestmentCtaAudit {
  staticOnly: true;
  /** Presentation button is allowed; click / route is not. */
  interactiveControlAllowed: false;
  liveInvestabilityUsed: false;
  routeInFrozenHtmlAllowed: false;
  minimumInvestment: {
    source: "MARKETPLACE_MIN_COMMIT_MYR";
    formatter: "formatProspectusMoneyMyr";
    capacityAdjustedMinimumUsed: false;
  };
  claims: {
    /** Static Canva description only — not a generated claim engine. */
    staticCanvaDescriptionAllowed: true;
    generatedMarketingClaimAllowed: false;
  };
}

export const PROSPECTUS_INVESTMENT_CTA_AUDIT: ProspectusInvestmentCtaAudit = {
  staticOnly: true,
  interactiveControlAllowed: false,
  liveInvestabilityUsed: false,
  routeInFrozenHtmlAllowed: false,
  minimumInvestment: {
    source: "MARKETPLACE_MIN_COMMIT_MYR",
    formatter: "formatProspectusMoneyMyr",
    capacityAdjustedMinimumUsed: false,
  },
  claims: {
    staticCanvaDescriptionAllowed: true,
    generatedMarketingClaimAllowed: false,
  },
};

/**
 * Frozen Canva-facing fields.
 * `buttonHref` is reserved for a future investor route — always null today
 * so the button renders as non-clickable presentation only.
 */
export interface ProspectusInvestmentCta {
  sectionHeading: string;
  /** Static Canva body copy above the button. */
  description: string;
  buttonLabel: string;
  /** When null, HTML renders a disabled presentation control (no navigation). */
  buttonHref: string | null;
  minimumInvestmentStatement: string;
  /** Audit/debug only — omitted from investor HTML. */
  audit: ProspectusInvestmentCtaAudit;
}

export interface ProspectusInvestmentCtaFieldSource {
  label: string;
  canonicalSource: string;
  availability: "static" | "reserved";
  surface: "canva" | "audit";
  notes: string;
}

export const PROSPECTUS_INVESTMENT_CTA_FIELD_SOURCES: Record<
  | "sectionHeading"
  | "description"
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
  description: {
    label: "CTA description",
    canonicalSource: "static",
    availability: "static",
    surface: "canva",
    notes: PROSPECTUS_INVEST_CTA_DESCRIPTION,
  },
  buttonLabel: {
    label: "CTA Button Label",
    canonicalSource: "static",
    availability: "static",
    surface: "canva",
    notes: "INVEST NOW — visual only until a future approved route is attached",
  },
  buttonHref: {
    label: "CTA Destination",
    canonicalSource: "none",
    availability: "reserved",
    surface: "audit",
    notes: "Always null in frozen Prospectus today. Future optional investor path only.",
  },
  minimumInvestmentStatement: {
    label: "Minimum Investment Statement",
    canonicalSource: "MARKETPLACE_MIN_COMMIT_MYR",
    availability: "static",
    surface: "canva",
    notes: "Platform floor via formatProspectusMoneyMyr. Not capacity-adjusted minCommit.",
  },
};
