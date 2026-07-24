/**
 * SECTION: Stored prospectus review content + conversion to builder publication content
 * WHY: Persist officer highlight copy; resolve fixed Shariah + catalogues for other steps
 */

import {
  PROSPECTUS_ABOUT_INVOICE_ITEM_IDS,
  PROSPECTUS_FIXED_PAYMENT_BASIS,
  PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT,
  PROSPECTUS_FIXED_SHARIAH_PRINCIPLE,
  PROSPECTUS_HIGHLIGHT_KEYS,
  buildProspectusAboutInvoiceRecommendations,
  buildProspectusHighlightRecommendations,
  normalizeProspectusCompanySize,
  normalizeProspectusConfidenceGrading,
  normalizeProspectusDeedOfAssignment,
  normalizeProspectusPaymasterRating,
  type ProspectusAboutInvoiceItem,
  type ProspectusAboutInvoiceItemId,
  type ProspectusAboutInvoiceRecommendationInput,
  type ProspectusAboutInvoiceSourceType,
  type ProspectusCompanySize,
  type ProspectusConfidenceGrading,
  type ProspectusDeedOfAssignment,
  type ProspectusHighlightKey,
  type ProspectusHighlightRecommendationInput,
  type ProspectusPaymasterRating,
} from "@cashsouk/types";
import {
  PROSPECTUS_INVOICE_WORK_OPTION_CATALOGUE,
  PROSPECTUS_OPTION_CATALOGUE_VERSION,
  PROSPECTUS_TAKEAWAY_KEYS,
  PROSPECTUS_TAKEAWAY_OPTION_CATALOGUE,
  findCatalogueOption,
  findCreditInsightCatalogueOption,
} from "./prospectus-option-catalogues";
import type {
  ProspectusCreditInsightFieldKey,
  ProspectusCreditInsightOptionKey,
  ProspectusInvestorTakeawayCategoryKey,
  ProspectusPublicationContent,
} from "../prospectus/prospectus-placeholder-publication-content";
import { PROSPECTUS_PUBLICATION_CONTENT_SOURCE } from "../prospectus/prospectus-placeholder-publication-content";

export interface ProspectusReviewHighlightSelection {
  key: string;
  title: string;
  description: string;
  /** @deprecated Legacy catalogue key — ignored. */
  optionKey?: string | null;
  /** @deprecated Legacy visibility — always displayed. */
  isVisible?: boolean;
}

/** @deprecated Prefer ProspectusAboutInvoiceItem / page2.aboutInvoice. */
export interface ProspectusReviewInvoiceWorkSelection {
  key: string;
  optionKey?: string | null;
  isVisible?: boolean;
}

export type { ProspectusAboutInvoiceItem, ProspectusAboutInvoiceSourceType };

export interface ProspectusReviewPaymasterTrackRecord {
  totalInvoicesPaid?: number | null;
  totalAmountPaid?: string | number | null;
  successfulRepaymentPercent?: string | number | null;
  onTimePaymentPercent?: string | number | null;
  averagePaymentPeriodDays?: string | number | null;
}

export interface ProspectusReviewManualFinancialYear {
  grossProfit?: string | number | null;
  ebitda?: string | number | null;
  ebit?: string | number | null;
  cashAndBank?: string | number | null;
  tradeReceivables?: string | number | null;
  totalEquity?: string | number | null;
  quickRatio?: string | number | null;
  operatingCashFlow?: string | number | null;
  freeCashFlow?: string | number | null;
  interestCoverage?: string | number | null;
  dscr?: string | number | null;
  debtEquity?: string | number | null;
  returnOnAssets?: string | number | null;
  receivablesDays?: string | number | null;
  payablesDays?: string | number | null;
  assetTurnover?: string | number | null;
}

/** Persisted draft/approved JSON shape. */
export interface ProspectusReviewStoredContent {
  page1: {
    keyInvestorHighlights: ProspectusReviewHighlightSelection[];
    /** @deprecated Legacy only — ignored for new resolve; Payment Basis is fixed. */
    paymentBasisOptionKey?: string | null;
    /** @deprecated Legacy only — ignored for new resolve; Shariah Principle is fixed. */
    shariahPrincipleOptionKey?: string | null;
  };
  page2: {
    /** Optional officer Issuer Profile inputs (not IssuerOrganization data). */
    issuerProfile?: {
      companySize?: ProspectusCompanySize | null;
    };
    /** Officer-selected Invoice & Paymaster fields — required before Approve. */
    invoicePaymaster?: {
      deedOfAssignment?: ProspectusDeedOfAssignment | null;
      paymasterRating?: ProspectusPaymasterRating | null;
      confidenceGrading?: ProspectusConfidenceGrading | null;
    };
    paymasterTrackRecord?: ProspectusReviewPaymasterTrackRecord;
    /** Officer overrides for unsupported Page 2 financial comparison metrics. */
    financialComparison?: {
      overrides?: Record<
        string,
        {
          netDebtEquity?: string | number | null;
          interestCoverage?: string | number | null;
          dscr?: string | number | null;
          receivablesDays?: string | number | null;
        }
      >;
    };
    creditInsights: {
      creditScoreOptionKey?: string | null;
      paymentBehaviourOptionKey?: string | null;
      creditUtilisationOptionKey?: string | null;
      litigationCheckOptionKey?: string | null;
      ccrisStatusOptionKey?: string | null;
    };
    aboutInvoice?: {
      items: ProspectusAboutInvoiceItem[];
    };
    /** @deprecated Prefer aboutInvoice — migrated on normalize. */
    invoiceWorkStatements?: ProspectusReviewInvoiceWorkSelection[];
  };
  page3: {
    manualFinancialInputs?: {
      years: Record<string, ProspectusReviewManualFinancialYear>;
    };
    investorTakeaways: {
      revenueProfitabilityOptionKey?: string | null;
      liquidityOptionKey?: string | null;
      leverageOptionKey?: string | null;
      debtServicingCapacityOptionKey?: string | null;
      receivablesCollectionOptionKey?: string | null;
      overallFinancialProfileOptionKey?: string | null;
    };
  };
}

/** Drop legacy Payment Basis / Shariah Principle keys from new write paths. */
export function stripLegacyPaymentBasisShariahKeys(
  content: ProspectusReviewStoredContent
): ProspectusReviewStoredContent {
  const cloned = cloneReviewContent(content);
  delete cloned.page1.paymentBasisOptionKey;
  delete cloned.page1.shariahPrincipleOptionKey;
  return cloned;
}

function trimCopy(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Ensure four highlight rows exist; fill empty title/description from recommendations;
 * force Shariah fixed copy; drop legacy optionKey/isVisible on write normalisation.
 */
export function normalizeHighlightSelections(
  content: ProspectusReviewStoredContent,
  recommendationInput: ProspectusHighlightRecommendationInput = {}
): ProspectusReviewStoredContent {
  const recommendations = buildProspectusHighlightRecommendations(recommendationInput);
  const byKey = new Map(
    content.page1.keyInvestorHighlights.map((h) => [h.key, h] as const)
  );

  const keyInvestorHighlights = PROSPECTUS_HIGHLIGHT_KEYS.map((key) => {
    const existing = byKey.get(key);
    if (key === "shariah") {
      return {
        key,
        title: PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT.title,
        description: PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT.description,
      };
    }
    const recommended = recommendations[key as ProspectusHighlightKey];
    const title = trimCopy(existing?.title) || recommended.title;
    const description = trimCopy(existing?.description) || recommended.description;
    return { key, title, description };
  });

  return {
    ...content,
    page1: {
      ...content.page1,
      keyInvestorHighlights,
    },
  };
}

function isAboutInvoiceSourceType(value: unknown): value is ProspectusAboutInvoiceSourceType {
  return value === "SYSTEM_SUGGESTION" || value === "OFFICER_ENTERED";
}

function legacyInvoiceWorkText(key: string, optionKey: string | null | undefined): string {
  if (!optionKey || optionKey === "do_not_display") return "";
  const catalogue = PROSPECTUS_INVOICE_WORK_OPTION_CATALOGUE[key] ?? [];
  return trimCopy(findCatalogueOption(catalogue, optionKey)?.renderedText);
}

function aboutInvoiceRecommendationInputFromContent(
  content: ProspectusReviewStoredContent,
  input: ProspectusAboutInvoiceRecommendationInput = {}
): ProspectusAboutInvoiceRecommendationInput {
  return {
    ...input,
    deedOfAssignment:
      input.deedOfAssignment !== undefined
        ? input.deedOfAssignment
        : content.page2.invoicePaymaster?.deedOfAssignment ?? null,
  };
}

/** Highlights + About Invoice normalize for save / approve / GET. */
export function normalizeProspectusReviewSelections(
  content: ProspectusReviewStoredContent,
  recommendationInput: ProspectusHighlightRecommendationInput = {},
  aboutInvoiceInput: ProspectusAboutInvoiceRecommendationInput = {}
): ProspectusReviewStoredContent {
  return normalizeAboutInvoiceSelections(
    normalizeHighlightSelections(content, recommendationInput),
    aboutInvoiceInput
  );
}

/**
 * Ensure four About Invoice rows exist.
 * - OFFICER_ENTERED text is never overwritten.
 * - Untouched SYSTEM_SUGGESTION rows are regenerated from Canva templates + Note tokens.
 * - Legacy catalogue optionKey rows migrate once as OFFICER_ENTERED.
 */
export function normalizeAboutInvoiceSelections(
  content: ProspectusReviewStoredContent,
  aboutInvoiceInput: ProspectusAboutInvoiceRecommendationInput = {}
): ProspectusReviewStoredContent {
  const suggestions = buildProspectusAboutInvoiceRecommendations(
    aboutInvoiceRecommendationInputFromContent(content, aboutInvoiceInput)
  );
  const byId = new Map(
    (content.page2.aboutInvoice?.items ?? []).map((item) => [item.id, item] as const)
  );
  const legacyByKey = new Map(
    (content.page2.invoiceWorkStatements ?? []).map((row) => [row.key, row] as const)
  );

  const items: ProspectusAboutInvoiceItem[] = PROSPECTUS_ABOUT_INVOICE_ITEM_IDS.map((id) => {
    const existing = byId.get(id);
    const sourceType = isAboutInvoiceSourceType(existing?.sourceType)
      ? existing.sourceType
      : existing
        ? "OFFICER_ENTERED"
        : null;
    const existingText = trimCopy(existing?.text);

    // Ops-edited copy is frozen against regeneration.
    if (sourceType === "OFFICER_ENTERED") {
      return {
        id,
        text: existingText,
        sourceType: "OFFICER_ENTERED",
      };
    }

    // Legacy catalogue pick → officer-owned wording once.
    if (!existing && !content.page2.aboutInvoice) {
      const legacy = legacyByKey.get(id);
      const legacyText = legacyInvoiceWorkText(id, legacy?.optionKey);
      if (legacyText) {
        return { id, text: legacyText, sourceType: "OFFICER_ENTERED" };
      }
    }

    // Empty or SYSTEM_SUGGESTION → refresh from current templates/tokens.
    return {
      id,
      text: suggestions[id as ProspectusAboutInvoiceItemId].text,
      sourceType: "SYSTEM_SUGGESTION",
    };
  });

  return {
    ...content,
    page2: {
      ...content.page2,
      aboutInvoice: { items },
      invoiceWorkStatements: items.map((item) => ({
        key: item.id,
        optionKey: null,
        isVisible: true,
      })),
    },
  };
}

export function emptyProspectusReviewContent(
  recommendationInput: ProspectusHighlightRecommendationInput = {},
  aboutInvoiceInput: ProspectusAboutInvoiceRecommendationInput = {}
): ProspectusReviewStoredContent {
  const recommendations = buildProspectusHighlightRecommendations(recommendationInput);
  const aboutSuggestions = buildProspectusAboutInvoiceRecommendations({
    ...aboutInvoiceInput,
    deedOfAssignment: aboutInvoiceInput.deedOfAssignment ?? null,
  });
  return {
    page1: {
      keyInvestorHighlights: PROSPECTUS_HIGHLIGHT_KEYS.map((key) => ({
        key,
        title: recommendations[key].title,
        description: recommendations[key].description,
      })),
    },
    page2: {
      issuerProfile: { companySize: null },
      invoicePaymaster: {
        deedOfAssignment: null,
        paymasterRating: null,
        confidenceGrading: null,
      },
      paymasterTrackRecord: {},
      financialComparison: { overrides: {} },
      creditInsights: {},
      aboutInvoice: {
        items: PROSPECTUS_ABOUT_INVOICE_ITEM_IDS.map((id) => ({
          id,
          text: aboutSuggestions[id].text,
          sourceType: "SYSTEM_SUGGESTION" as const,
        })),
      },
      invoiceWorkStatements: PROSPECTUS_ABOUT_INVOICE_ITEM_IDS.map((id) => ({
        key: id,
        optionKey: null,
        isVisible: true,
      })),
    },
    page3: {
      manualFinancialInputs: { years: {} },
      investorTakeaways: {},
    },
  };
}

function creditKeyToOption(
  field: ProspectusCreditInsightFieldKey,
  key: string | null | undefined
): ProspectusCreditInsightOptionKey | undefined {
  if (!key) return undefined;
  const hit = findCreditInsightCatalogueOption(field, key);
  return hit ? hit.key : undefined;
}

/**
 * Resolve stored officer selections into builder publication content.
 * Highlights are always visible; Shariah copy is always the fixed template.
 */
export function toProspectusPublicationContent(
  content: ProspectusReviewStoredContent
): ProspectusPublicationContent {
  const normalized = normalizeProspectusReviewSelections(content);
  const highlights = normalized.page1.keyInvestorHighlights.map((h) => {
    const isShariah = h.key === "shariah";
    return {
      key: h.key,
      title: isShariah ? PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT.title : trimCopy(h.title),
      description: isShariah
        ? PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT.description
        : trimCopy(h.description),
      sourceType: isShariah
        ? ("fixed_template" as const)
        : ("placeholder_manual" as const),
      isVisible: true,
    };
  });

  const creditInsights: Partial<
    Record<ProspectusCreditInsightFieldKey, ProspectusCreditInsightOptionKey>
  > = {};
  const ci = content.page2.creditInsights;
  const creditMap: Array<[ProspectusCreditInsightFieldKey, string | null | undefined]> = [
    ["creditScore", ci.creditScoreOptionKey],
    ["paymentBehaviour", ci.paymentBehaviourOptionKey],
    ["creditUtilisation", ci.creditUtilisationOptionKey],
    ["litigationCheck", ci.litigationCheckOptionKey],
    ["ccrisStatus", ci.ccrisStatusOptionKey],
  ];
  for (const [field, key] of creditMap) {
    const resolved = creditKeyToOption(field, key);
    if (resolved) creditInsights[field] = resolved;
  }

  const invoiceWorkStatements = (normalized.page2.aboutInvoice?.items ?? []).map((item) => {
    const text = trimCopy(item.text);
    return {
      key: item.id,
      text,
      isVisible: text.length > 0,
      sourceType:
        item.sourceType === "SYSTEM_SUGGESTION"
          ? ("derived_suggestion" as const)
          : ("placeholder_manual" as const),
    };
  });

  const takeawaySelections: Partial<Record<ProspectusInvestorTakeawayCategoryKey, string>> =
    {};
  const t = content.page3.investorTakeaways;
  const takeawayMap: Array<[ProspectusInvestorTakeawayCategoryKey, string | null | undefined]> = [
    ["revenue_profitability", t.revenueProfitabilityOptionKey],
    ["liquidity", t.liquidityOptionKey],
    ["leverage", t.leverageOptionKey],
    ["debt_servicing_capacity", t.debtServicingCapacityOptionKey],
    ["receivables_collection", t.receivablesCollectionOptionKey],
    ["overall_financial_profile", t.overallFinancialProfileOptionKey],
  ];
  for (const [category, key] of takeawayMap) {
    if (key) takeawaySelections[category] = key;
  }

  const investorTakeawayOptions = Object.fromEntries(
    PROSPECTUS_TAKEAWAY_KEYS.map((category) => [
      category,
      (PROSPECTUS_TAKEAWAY_OPTION_CATALOGUE[category] ?? []).map((o) => ({
        key: o.key,
        text: o.renderedText,
      })),
    ])
  ) as ProspectusPublicationContent["investorTakeawayOptions"];

  return {
    meta: {
      ...PROSPECTUS_PUBLICATION_CONTENT_SOURCE,
      kind: "development_placeholder",
      legallyApproved: false,
    },
    keyInvestorHighlights: highlights,
    paymentBasisTemplate: {
      paymentBasis: PROSPECTUS_FIXED_PAYMENT_BASIS,
      shariahPrinciple: PROSPECTUS_FIXED_SHARIAH_PRINCIPLE,
      sourceType: "fixed_template",
      approvedProductionCopy: true,
    },
    issuerProfile: {
      companySize: normalizeProspectusCompanySize(content.page2.issuerProfile?.companySize),
    },
    invoicePaymaster: {
      deedOfAssignment: normalizeProspectusDeedOfAssignment(
        content.page2.invoicePaymaster?.deedOfAssignment
      ),
      paymasterRating: normalizeProspectusPaymasterRating(
        content.page2.invoicePaymaster?.paymasterRating
      ),
      confidenceGrading: normalizeProspectusConfidenceGrading(
        content.page2.invoicePaymaster?.confidenceGrading
      ),
    },
    paymasterTrackRecord: content.page2.paymasterTrackRecord,
    financialComparison: {
      overrides: content.page2.financialComparison?.overrides ?? {},
    },
    creditInsightSelections: creditInsights,
    invoiceWorkStatements,
    investorTakeawayOptions,
    investorTakeawaySelections: takeawaySelections,
    prospectusFinancialInputs: content.page3.manualFinancialInputs,
  };
}

export function catalogueVersion(): string {
  return PROSPECTUS_OPTION_CATALOGUE_VERSION;
}

/** Frozen snapshot branch shape written at publish. */
export interface ProspectusFrozenPublicationContent {
  version: string;
  optionCatalogueVersion: string;
  approvedAt: string;
  approvedBy: string;
  /** Officer option keys — audit / reopen seed. */
  content: ProspectusReviewStoredContent;
  /**
   * Immutable resolved wording + manual values at approval/publish time.
   * Published renderers MUST prefer this over re-resolving the live catalogue.
   */
  resolvedPublicationContent: ProspectusPublicationContent;
}

/** Deep clone JSON-safe review content (no shared mutable references). */
export function cloneReviewContent(
  content: ProspectusReviewStoredContent
): ProspectusReviewStoredContent {
  return JSON.parse(JSON.stringify(content)) as ProspectusReviewStoredContent;
}
