/**
 * SECTION: Prospectus Page 2 — Investment CTA (DATA STAGE 8)
 * WHY: Static frozen wording only; live invest controls stay on the marketplace
 */

export const PROSPECTUS_INVESTMENT_CTA_SECTION_HEADING = "INVEST WITH CONFIDENCE";

/** Closest current prospectus wording pattern: "Minimum investment: {money}". */
export const PROSPECTUS_MINIMUM_INVESTMENT_STATEMENT_PREFIX = "Minimum investment:";

export interface ProspectusInvestmentCtaAudit {
  staticOnly: true;
  interactiveControlAllowed: false;
  liveInvestabilityUsed: false;
  routeInFrozenHtmlAllowed: false;
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
    attractiveReturnAllowed: false,
    shortTermClaimAllowed: false,
    shariahCompliantInvestmentClaimAllowed: false,
  },
};

/** Frozen Canva-facing fields only — no button, route, or live capacity. */
export interface ProspectusInvestmentCta {
  sectionHeading: string;
  minimumInvestmentStatement: string;
  /** Audit/debug only — omitted from investor HTML. */
  audit: ProspectusInvestmentCtaAudit;
}

export interface ProspectusInvestmentCtaFieldSource {
  label: string;
  canonicalSource: string;
  availability: "static";
  surface: "canva" | "audit";
  notes: string;
}

export const PROSPECTUS_INVESTMENT_CTA_FIELD_SOURCES: Record<
  "sectionHeading" | "minimumInvestmentStatement",
  ProspectusInvestmentCtaFieldSource
> = {
  sectionHeading: {
    label: "Section heading",
    canonicalSource: "static",
    availability: "static",
    surface: "canva",
    notes: "INVEST WITH CONFIDENCE — heading only; not a claim generator",
  },
  minimumInvestmentStatement: {
    label: "Minimum Investment Statement",
    canonicalSource: "MARKETPLACE_MIN_COMMIT_MYR",
    availability: "static",
    surface: "canva",
    notes: "Platform floor via formatProspectusMoneyMyr. Not capacity-adjusted minCommit.",
  },
};
