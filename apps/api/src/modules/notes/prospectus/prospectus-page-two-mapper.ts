/**
 * SECTION: Map Page 2 Prisma data → Stage 1–8 builders → assembled Page 2
 * WHY: Prefer frozen Stage 4 snapshot when published; never live-fallback published
 */

import { buildProspectusCreditInsights } from "./prospectus-credit-insights";
import { buildProspectusFinancialComparisonMetrics } from "./prospectus-financial-comparison-metrics";
import { buildProspectusFinancialComparisonSource } from "./prospectus-financial-comparison-source";
import { withProspectusThreeYearDisplay } from "./prospectus-three-year-display";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_FINANCIAL_COMPARISON_SECTION_HEADING,
  PROSPECTUS_FINANCIAL_COMPARISON_SOURCE_AUDIT,
  PROSPECTUS_FINANCIAL_COMPARISON_TABLE_UNIT_LABEL,
  type ProspectusFinancialComparisonSource,
  type ProspectusFinancialComparisonYear,
} from "./prospectus-financial-comparison-source.types";
import { buildProspectusHeader } from "./prospectus-header";
import { buildProspectusInvestmentCta } from "./prospectus-investment-cta";
import { buildProspectusInvoicePaymaster } from "./prospectus-invoice-paymaster";
import { buildProspectusInvoiceWorkNarrative } from "./prospectus-invoice-work-narrative";
import { buildProspectusIssuerProfile } from "./prospectus-issuer-profile";
import {
  parseInvoiceSnapshotRiskRating,
  parseProspectusPageTwoSnapshot,
} from "./prospectus-json-guards";
import { isProspectusNotePublished } from "./prospectus-page-one-prisma";
import type { ProspectusPageTwoLoadedData } from "./prospectus-page-two-prisma";
import type {
  ProspectusPageTwo,
  ProspectusPageTwoFinancialMode,
} from "./prospectus-page-two.types";
import { buildProspectusPaymasterTrackRecord } from "./prospectus-paymaster-track-record";
import type { ProspectusPage2FinancialComparisonSnapshot } from "./prospectus-snapshot.types";
import { buildProspectusSoukscoreRatingScale } from "./prospectus-soukscore-rating-scale";
import { publicationContentFromFrozenSnapshot } from "../prospectus-review/prospectus-frozen-publication";

export type ProspectusPageTwoBuilderInput = {
  noteId: string;
  noteReference: string;
  isPublished: boolean;
  financialMode: ProspectusPageTwoFinancialMode;
  issuerSnapshot: unknown;
  invoiceSnapshot: unknown;
  paymasterSnapshot: unknown;
  maturityDate: Date | null;
  /** Live Application financials — only for unpublished preview. */
  liveFinancialStatements: unknown | null;
  /** Live organization CTOS financials_json — only for unpublished preview. */
  liveCtosFinancials: unknown | null;
  /** Parsed frozen Stage 4 — only when published + valid. */
  frozenFinancialComparison: ProspectusPage2FinancialComparisonSnapshot | null;
  marcSnapshot?: import("@cashsouk/types").MarcAssessmentSnapshot | null;
  /**
   * Preview/development publication placeholders only.
   * Prisma Note mapping must leave this undefined.
   */
  publicationContent?: import("./prospectus-placeholder-publication-content").ProspectusPublicationContent;
};

function emptyFinancialComparisonSource(): ProspectusFinancialComparisonSource {
  return {
    sectionHeading: PROSPECTUS_FINANCIAL_COMPARISON_SECTION_HEADING,
    tableUnitLabel: PROSPECTUS_FINANCIAL_COMPARISON_TABLE_UNIT_LABEL,
    sourceFooter: "Source: Financial Statements",
    years: [],
    missingSsmUnauditedYears: [],
    opsWarning: null,
    audit: PROSPECTUS_FINANCIAL_COMPARISON_SOURCE_AUDIT,
  };
}

/**
 * Reconstruct Stage 4A view-model from frozen publication snapshot.
 * Does not re-run live year selection.
 */
export function buildFinancialComparisonSourceFromFrozen(
  frozen: ProspectusPage2FinancialComparisonSnapshot
): ProspectusFinancialComparisonSource {
  const years: ProspectusFinancialComparisonYear[] = frozen.selected_years.map((year) => {
    const financialYearEndIso =
      year.financial_year_end_iso ??
      (year.financial_year_end_label && /^\d{4}-\d{2}-\d{2}$/.test(year.financial_year_end_label)
        ? year.financial_year_end_label
        : `${year.year}-12-31`);
    return {
      year: year.year,
      yearLabel: year.year_label,
      financialYearEndIso,
      financialYearEndLabel: year.financial_year_end_label ?? PROSPECTUS_DATA_NOT_AVAILABLE,
      recordSource: year.record_source ?? "unaudited_management",
      // Shared Page 2 + Page 3 freeze — include extended keys when present (null when absent).
      rawFinancials: {
        turnover: year.raw_financials.turnover,
        plnpat: year.raw_financials.plnpat,
        bsqpuc: year.raw_financials.bsqpuc,
        bscatot: year.raw_financials.bscatot,
        curlib: year.raw_financials.curlib,
        plnpbt: year.raw_financials.plnpbt,
        bsfatot: year.raw_financials.bsfatot,
        othass: year.raw_financials.othass,
        bsclbank: year.raw_financials.bsclbank,
        bsslltd: year.raw_financials.bsslltd,
        bsclstd: year.raw_financials.bsclstd,
        totass: year.raw_financials.totass,
        totlib: year.raw_financials.totlib,
        networth: year.raw_financials.networth,
        profit_margin: year.raw_financials.profit_margin,
        return_on_equity: year.raw_financials.return_on_equity,
        currat: year.raw_financials.currat,
        gear: year.raw_financials.gear ?? null,
      },
    };
  });

  return {
    sectionHeading: PROSPECTUS_FINANCIAL_COMPARISON_SECTION_HEADING,
    tableUnitLabel: PROSPECTUS_FINANCIAL_COMPARISON_TABLE_UNIT_LABEL,
    sourceFooter: frozen.source_footer ?? "Source: Financial Statements",
    years,
    // Ops warning is live-only; frozen publication HTML does not carry Admin alerts.
    missingSsmUnauditedYears: [],
    opsWarning: null,
    audit: PROSPECTUS_FINANCIAL_COMPARISON_SOURCE_AUDIT,
  };
}

function resolveFinancialComparisonSource(
  input: ProspectusPageTwoBuilderInput
): ProspectusFinancialComparisonSource {
  if (input.financialMode === "frozen_publication_snapshot") {
    if (!input.frozenFinancialComparison) {
      return emptyFinancialComparisonSource();
    }
    return buildFinancialComparisonSourceFromFrozen(input.frozenFinancialComparison);
  }

  if (input.financialMode === "published_unavailable") {
    return emptyFinancialComparisonSource();
  }

  return buildProspectusFinancialComparisonSource({
    financialStatements: input.liveFinancialStatements,
    ctosFinancials: input.liveCtosFinancials,
  });
}

export function mapProspectusPageTwoDataToInput(
  data: ProspectusPageTwoLoadedData
): ProspectusPageTwoBuilderInput {
  const { note } = data;
  const isPublished = isProspectusNotePublished(note);
  const parsedPage2 = parseProspectusPageTwoSnapshot(note.prospectus_snapshot);

  let financialMode: ProspectusPageTwoFinancialMode;
  let frozenFinancialComparison: ProspectusPage2FinancialComparisonSnapshot | null = null;
  let liveFinancialStatements: unknown | null = null;
  let liveCtosFinancials: unknown | null = null;

  if (isPublished) {
    if (parsedPage2) {
      financialMode = "frozen_publication_snapshot";
      frozenFinancialComparison = parsedPage2.financial_comparison;
    } else {
      financialMode = "published_unavailable";
    }
  } else {
    financialMode = "live_unpublished_preview";
    liveFinancialStatements = data.liveFinancialStatements;
    liveCtosFinancials = data.liveCtosFinancials;
  }

  return {
    noteId: note.id,
    noteReference: note.note_reference,
    isPublished,
    financialMode,
    issuerSnapshot: note.issuer_snapshot,
    invoiceSnapshot: note.invoice_snapshot,
    paymasterSnapshot: note.paymaster_snapshot,
    maturityDate: note.maturity_date,
    liveFinancialStatements,
    liveCtosFinancials,
    frozenFinancialComparison,
    marcSnapshot: data.marcSnapshot ?? null,
    /** Published Notes: frozen officer content only — never mutable draft / placeholders. */
    publicationContent: isPublished
      ? publicationContentFromFrozenSnapshot(note.prospectus_snapshot)
      : undefined,
  };
}

export function buildProspectusPageTwo(
  input: ProspectusPageTwoBuilderInput
): ProspectusPageTwo {
  // Display pad after real-year resolve — freeze/snapshot still uses unpadded source.
  const financialComparisonSource = withProspectusThreeYearDisplay(
    resolveFinancialComparisonSource(input)
  );
  const financialComparisonMetrics = buildProspectusFinancialComparisonMetrics({
    source: financialComparisonSource,
    officerOverrides: input.publicationContent?.financialComparison?.overrides ?? null,
  });

  return {
    header: buildProspectusHeader(),
    issuerProfile: buildProspectusIssuerProfile({
      issuerSnapshot: input.issuerSnapshot,
      officerCompanySize: input.publicationContent?.issuerProfile?.companySize,
    }),
    invoicePaymaster: buildProspectusInvoicePaymaster({
      invoiceSnapshot: input.invoiceSnapshot,
      paymasterSnapshot: input.paymasterSnapshot,
      maturityDate: input.maturityDate,
      officerDeedOfAssignment: input.publicationContent?.invoicePaymaster?.deedOfAssignment,
    }),
    paymasterTrackRecord: buildProspectusPaymasterTrackRecord({
      officerInputs: input.publicationContent?.paymasterTrackRecord ?? null,
    }),
    financialComparisonSource,
    financialComparisonMetrics,
    creditInsights: buildProspectusCreditInsights({
      creditInsightSelections: input.publicationContent?.creditInsightSelections,
      marcSnapshot: input.marcSnapshot,
    }),
    invoiceWorkNarrative: buildProspectusInvoiceWorkNarrative({
      invoiceWorkStatements: input.publicationContent?.invoiceWorkStatements,
    }),
    soukscoreRatingScale: buildProspectusSoukscoreRatingScale({
      selectedRiskRating: parseInvoiceSnapshotRiskRating(input.invoiceSnapshot),
    }),
    investmentCta: buildProspectusInvestmentCta(),
    meta: {
      noteId: input.noteId,
      noteReference: input.noteReference,
      financialMode: input.financialMode,
      isPublished: input.isPublished,
    },
  };
}

export async function mapProspectusPageTwoFromNote(
  data: ProspectusPageTwoLoadedData
): Promise<ProspectusPageTwo> {
  return buildProspectusPageTwo(mapProspectusPageTwoDataToInput(data));
}
