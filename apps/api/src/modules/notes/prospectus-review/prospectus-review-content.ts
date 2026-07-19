/**
 * SECTION: Stored prospectus review content + conversion to builder publication content
 * WHY: Persist officer option keys separately; resolve wording from code catalogues at render
 */

import {
  PROSPECTUS_CREDIT_INSIGHT_OPTIONS,
  PROSPECTUS_HIGHLIGHT_KEYS,
  PROSPECTUS_HIGHLIGHT_OPTION_CATALOGUE,
  PROSPECTUS_INVOICE_WORK_KEYS,
  PROSPECTUS_INVOICE_WORK_OPTION_CATALOGUE,
  PROSPECTUS_OPTION_CATALOGUE_VERSION,
  PROSPECTUS_PAYMENT_BASIS_OPTIONS,
  PROSPECTUS_SHARIAH_PRINCIPLE_OPTIONS,
  PROSPECTUS_TAKEAWAY_KEYS,
  PROSPECTUS_TAKEAWAY_OPTION_CATALOGUE,
  findCatalogueOption,
} from "./prospectus-option-catalogues";
import type {
  ProspectusCreditInsightFieldKey,
  ProspectusCreditInsightOptionKey,
  ProspectusInvestorTakeawayCategoryKey,
  ProspectusPublicationContent,
} from "../prospectus/prospectus-placeholder-publication-content";
import { PROSPECTUS_PUBLICATION_CONTENT_SOURCE } from "../prospectus/prospectus-placeholder-publication-content";
import { PROSPECTUS_DATA_NOT_AVAILABLE } from "../prospectus/prospectus-note-identity.types";

export interface ProspectusReviewHighlightSelection {
  key: string;
  optionKey?: string | null;
  isVisible: boolean;
}

export interface ProspectusReviewInvoiceWorkSelection {
  key: string;
  optionKey?: string | null;
  isVisible: boolean;
}

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

/** Persisted draft/approved JSON shape (option keys, not resolved text). */
export interface ProspectusReviewStoredContent {
  page1: {
    keyInvestorHighlights: ProspectusReviewHighlightSelection[];
    paymentBasisOptionKey?: string | null;
    shariahPrincipleOptionKey?: string | null;
  };
  page2: {
    paymasterTrackRecord?: ProspectusReviewPaymasterTrackRecord;
    creditInsights: {
      creditScoreOptionKey?: string | null;
      paymentBehaviourOptionKey?: string | null;
      creditUtilisationOptionKey?: string | null;
      litigationCheckOptionKey?: string | null;
      ccrisStatusOptionKey?: string | null;
    };
    invoiceWorkStatements: ProspectusReviewInvoiceWorkSelection[];
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
      workingCapitalEfficiencyOptionKey?: string | null;
      overallFinancialProfileOptionKey?: string | null;
    };
  };
}

export function emptyProspectusReviewContent(): ProspectusReviewStoredContent {
  return {
    page1: {
      keyInvestorHighlights: PROSPECTUS_HIGHLIGHT_KEYS.map((key) => ({
        key,
        optionKey: null,
        isVisible: true,
      })),
      paymentBasisOptionKey: null,
      shariahPrincipleOptionKey: null,
    },
    page2: {
      paymasterTrackRecord: {},
      creditInsights: {},
      invoiceWorkStatements: PROSPECTUS_INVOICE_WORK_KEYS.map((key) => ({
        key,
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
  key: string | null | undefined
): ProspectusCreditInsightOptionKey | undefined {
  if (!key) return undefined;
  const hit = findCatalogueOption(PROSPECTUS_CREDIT_INSIGHT_OPTIONS, key);
  return hit ? (hit.key as ProspectusCreditInsightOptionKey) : undefined;
}

/**
 * Resolve stored officer selections into builder publication content.
 * Does not inject development placeholder defaults for missing selections.
 */
export function toProspectusPublicationContent(
  content: ProspectusReviewStoredContent
): ProspectusPublicationContent {
  const highlights = content.page1.keyInvestorHighlights.map((h) => {
    const catalogue = PROSPECTUS_HIGHLIGHT_OPTION_CATALOGUE[h.key] ?? [];
    const option = findCatalogueOption(catalogue, h.optionKey);
    const hidden = !h.isVisible || option?.key === "do_not_display" || !option;
    return {
      key: h.key,
      title: option?.label ?? "",
      description: option?.renderedText ?? "",
      sourceType: "fixed_template" as const,
      isVisible: !hidden && Boolean(option?.renderedText),
    };
  });

  const paymentOpt = findCatalogueOption(
    PROSPECTUS_PAYMENT_BASIS_OPTIONS,
    content.page1.paymentBasisOptionKey
  );
  const shariahOpt = findCatalogueOption(
    PROSPECTUS_SHARIAH_PRINCIPLE_OPTIONS,
    content.page1.shariahPrincipleOptionKey
  );

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
    const resolved = creditKeyToOption(key);
    if (resolved) creditInsights[field] = resolved;
  }

  const invoiceWorkStatements = content.page2.invoiceWorkStatements.map((s) => {
    const catalogue = PROSPECTUS_INVOICE_WORK_OPTION_CATALOGUE[s.key] ?? [];
    const option = findCatalogueOption(catalogue, s.optionKey);
    const hidden = !s.isVisible || option?.key === "do_not_display" || !option;
    return {
      key: s.key,
      text: option?.renderedText ?? "",
      isVisible: !hidden && Boolean(option?.renderedText),
      sourceType: "placeholder_manual" as const,
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
    ["working_capital_efficiency", t.workingCapitalEfficiencyOptionKey],
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
      paymentBasis:
        paymentOpt && paymentOpt.key !== "do_not_display" && paymentOpt.renderedText
          ? paymentOpt.renderedText
          : PROSPECTUS_DATA_NOT_AVAILABLE,
      shariahPrinciple:
        shariahOpt && shariahOpt.key !== "do_not_display" && shariahOpt.renderedText
          ? shariahOpt.renderedText
          : PROSPECTUS_DATA_NOT_AVAILABLE,
      sourceType: "fixed_template",
      approvedProductionCopy: false,
    },
    paymasterTrackRecord: content.page2.paymasterTrackRecord,
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
