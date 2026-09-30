/**
 * SECTION: Map Page 2 Prisma data → Stage 1–8 builders → assembled Page 2
 * WHY: Unpublished preview displays the Note financial snapshot; published renders the frozen
 * Stage 4 snapshot and never falls back
 */

import type { ApprovedFinancialResult, FinancialReviewCalculatedValues } from "@cashsouk/types";
import { AppError } from "../../../lib/http/error-handler";
import { buildProspectusCreditInsights } from "./prospectus-credit-insights";
import { buildProspectusFinancialComparisonMetrics } from "./prospectus-financial-comparison-metrics";
import {
  buildProspectusFinancialComparisonSourceFromResult,
  statementTypeFromRecordSource,
} from "./prospectus-financial-comparison-source";
import { legacyFrozenCalculatedValues } from "./prospectus-legacy-frozen-financials";
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
import type {
  ProspectusPageTwoLoadedData,
  ProspectusPageTwoNoteRecord,
} from "./prospectus-page-two-prisma";
import type {
  ProspectusPageTwo,
  ProspectusPageTwoFinancialMode,
} from "./prospectus-page-two.types";
import { buildProspectusPaymasterTrackRecord } from "./prospectus-paymaster-track-record";
import {
  PROSPECTUS_PAGE2_FINANCIAL_FREEZE_VERSION,
  type ProspectusPage2FinancialComparisonSnapshot,
  type ProspectusPage2FinancialYearSnapshot,
} from "./prospectus-snapshot.types";
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
  /** Approved Financial Review result from the Note financial snapshot — unpublished preview only. */
  approvedFinancialResult: ApprovedFinancialResult | null;
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
    adminFallbackEligibleYears: [],
    missingSsmUnauditedYears: [],
    opsWarning: null,
    audit: PROSPECTUS_FINANCIAL_COMPARISON_SOURCE_AUDIT,
  };
}

/** Pre-version-2 freezes carried 18 raw keys; keep reading exactly those. */
function legacyFrozenRawFinancials(
  raw: ProspectusPage2FinancialYearSnapshot["raw_financials"]
): Record<string, unknown> {
  return {
    turnover: raw.turnover,
    plnpat: raw.plnpat,
    bsqpuc: raw.bsqpuc,
    bscatot: raw.bscatot,
    curlib: raw.curlib,
    plnpbt: raw.plnpbt,
    bsfatot: raw.bsfatot,
    othass: raw.othass,
    bsclbank: raw.bsclbank,
    bsslltd: raw.bsslltd,
    bsclstd: raw.bsclstd,
    totass: raw.totass,
    totlib: raw.totlib,
    networth: raw.networth,
    profit_margin: raw.profit_margin,
    return_on_equity: raw.return_on_equity,
    currat: raw.currat,
    gear: raw.gear ?? null,
  };
}

/** A version-2 freeze always carries the stored calculated values (the strict parser enforces it). */
function completeFrozenCalculatedValues(
  year: ProspectusPage2FinancialYearSnapshot
): FinancialReviewCalculatedValues {
  if (!year.calculated_values) {
    throw new AppError(
      500,
      "PROSPECTUS_FINANCIAL_FREEZE_INVALID",
      "Prospectus financial freeze has no calculated values"
    );
  }
  return { ...year.calculated_values };
}

function frozenYearToSourceYear(
  year: ProspectusPage2FinancialYearSnapshot,
  complete: boolean
): ProspectusFinancialComparisonYear {
  const financialYearEndIso =
    year.financial_year_end_iso ??
    (year.financial_year_end_label && /^\d{4}-\d{2}-\d{2}$/.test(year.financial_year_end_label)
      ? year.financial_year_end_label
      : `${year.year}-12-31`);
  const recordSource = year.record_source ?? "unaudited_management";
  // Old freezes did not store the statement type; they derive it from the record source.
  const derivedStatementType = statementTypeFromRecordSource(year.record_source ?? null);
  return {
    year: year.year,
    yearLabel: year.year_label,
    financialYearEndIso,
    financialYearEndLabel: year.financial_year_end_label ?? PROSPECTUS_DATA_NOT_AVAILABLE,
    recordSource,
    statementType: complete
      ? (year.statement_type ?? derivedStatementType)
      : derivedStatementType,
    rawFinancials: complete
      ? { ...year.raw_financials }
      : legacyFrozenRawFinancials(year.raw_financials),
    calculatedValues: complete
      ? completeFrozenCalculatedValues(year)
      : legacyFrozenCalculatedValues(year.raw_financials),
  };
}

/**
 * Reconstruct Stage 4A view-model from frozen publication snapshot.
 * Does not re-run year selection.
 * Version 2: the frozen raw values, stored calculated values, statement type and missing-year
 * state, so the render equals the preview it was frozen from. Older freezes render as they
 * always have (their metrics come from prospectus-legacy-frozen-financials).
 */
export function buildFinancialComparisonSourceFromFrozen(
  frozen: ProspectusPage2FinancialComparisonSnapshot
): ProspectusFinancialComparisonSource {
  const complete = frozen.freeze_version === PROSPECTUS_PAGE2_FINANCIAL_FREEZE_VERSION;
  const missingSsmUnauditedYears = complete ? [...(frozen.missing_ssm_unaudited_years ?? [])] : [];

  return {
    sectionHeading: PROSPECTUS_FINANCIAL_COMPARISON_SECTION_HEADING,
    tableUnitLabel: PROSPECTUS_FINANCIAL_COMPARISON_TABLE_UNIT_LABEL,
    sourceFooter: frozen.source_footer ?? "Source: Financial Statements",
    years: frozen.selected_years.map((year) => frozenYearToSourceYear(year, complete)),
    // Old freezes did not carry the ops state; the warning never reaches investor HTML.
    missingSsmUnauditedYears,
    opsWarning: complete ? (frozen.ops_warning ?? null) : null,
    // Admin Input eligibility is a Financial Review editing affordance, not part of the approved result.
    adminFallbackEligibleYears: [],
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

  // Unpublished preview: the Note financial snapshot (the loader throws when it is missing).
  if (!input.approvedFinancialResult) {
    throw new AppError(500, "NOTE_FINANCIAL_SNAPSHOT_INVALID", "Note financial snapshot is invalid");
  }
  return buildProspectusFinancialComparisonSourceFromResult(input.approvedFinancialResult);
}

export function mapProspectusPageTwoDataToInput(
  data: ProspectusPageTwoLoadedData
): ProspectusPageTwoBuilderInput {
  const { note } = data;
  const isPublished = isProspectusNotePublished(note);
  const parsedPage2 = parseProspectusPageTwoSnapshot(note.prospectus_snapshot);

  let financialMode: ProspectusPageTwoFinancialMode;
  let frozenFinancialComparison: ProspectusPage2FinancialComparisonSnapshot | null = null;
  let approvedFinancialResult: ApprovedFinancialResult | null = null;

  if (isPublished) {
    if (parsedPage2) {
      financialMode = "frozen_publication_snapshot";
      frozenFinancialComparison = parsedPage2.financial_comparison;
    } else {
      financialMode = "published_unavailable";
    }
  } else {
    // Unpublished preview reads the Note financial snapshot (mode name kept for callers).
    financialMode = "live_unpublished_preview";
    approvedFinancialResult = data.approvedFinancialResult;
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
    approvedFinancialResult,
    frozenFinancialComparison,
    marcSnapshot: data.marcSnapshot ?? null,
    /** Published Notes: frozen officer content only — never mutable draft / placeholders. */
    publicationContent: isPublished
      ? publicationContentFromFrozenSnapshot(note.prospectus_snapshot)
      : undefined,
  };
}

/**
 * Page 2 input for an approved Prospectus: Stage 4 from the approval freeze whatever the Note's
 * publish state. Never receives the Note financial snapshot or Application / CTOS financials.
 */
export function mapProspectusPageTwoApprovedInput(input: {
  note: ProspectusPageTwoNoteRecord;
  marcSnapshot: import("@cashsouk/types").MarcAssessmentSnapshot | null;
  frozenFinancialComparison: ProspectusPage2FinancialComparisonSnapshot;
  publicationContent: import("./prospectus-placeholder-publication-content").ProspectusPublicationContent;
}): ProspectusPageTwoBuilderInput {
  const base = mapProspectusPageTwoDataToInput({
    note: input.note,
    approvedFinancialResult: null,
    marcSnapshot: input.marcSnapshot,
  });
  return {
    ...base,
    financialMode: "frozen_publication_snapshot",
    approvedFinancialResult: null,
    frozenFinancialComparison: input.frozenFinancialComparison,
    publicationContent: input.publicationContent,
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
