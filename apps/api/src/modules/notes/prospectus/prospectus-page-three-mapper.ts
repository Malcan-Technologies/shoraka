/**
 * SECTION: Map Page 3 Prisma data → Stages 1–6 → assembled Page 3
 * WHY: Prefer frozen page_2 financial_comparison when published; never live-fallback
 */

import { buildProspectusFinancialComparisonSource } from "./prospectus-financial-comparison-source";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_FINANCIAL_COMPARISON_SECTION_HEADING,
  PROSPECTUS_FINANCIAL_COMPARISON_SOURCE_AUDIT,
  type ProspectusFinancialComparisonSource,
} from "./prospectus-financial-comparison-source.types";
import { buildProspectusHeader } from "./prospectus-header";
import {
  parseInvoiceSnapshotRiskRating,
  parseIssuerSnapshot,
  parsePaymasterSnapshot,
  parseProspectusPageTwoSnapshot,
} from "./prospectus-json-guards";
import { buildProspectusPageThreeBalanceSheet } from "./prospectus-page-three-balance-sheet";
import { buildProspectusPageThreeCoverageEfficiency } from "./prospectus-page-three-coverage-efficiency";
import { buildProspectusPageThreeIncomeStatement } from "./prospectus-page-three-income-statement";
import { buildProspectusPageThreeInvestorTakeaways } from "./prospectus-page-three-investor-takeaways";
import { buildProspectusPageThreeMetadata } from "./prospectus-page-three-metadata";
import { buildProspectusPageThreeTrends } from "./prospectus-page-three-trends";
import type { ProspectusPageThreeLoadedData } from "./prospectus-page-three-prisma";
import { isProspectusNotePublished } from "./prospectus-page-three-prisma";
import type {
  ProspectusPageThree,
  ProspectusPageThreeFinancialMode,
} from "./prospectus-page-three.types";
import { buildFinancialComparisonSourceFromFrozen } from "./prospectus-page-two-mapper";
import type { ProspectusPage2FinancialComparisonSnapshot } from "./prospectus-snapshot.types";

export type ProspectusPageThreeBuilderInput = {
  noteId: string;
  isPublished: boolean;
  financialMode: ProspectusPageThreeFinancialMode;
  issuerSnapshot: unknown;
  invoiceSnapshot: unknown;
  paymasterSnapshot: unknown;
  /** Live Application financials — only for unpublished preview. */
  liveFinancialStatements: unknown | null;
  /** Parsed frozen page_2 Stage 4 — only when published + valid. */
  frozenFinancialComparison: ProspectusPage2FinancialComparisonSnapshot | null;
};

function emptyFinancialComparisonSource(): ProspectusFinancialComparisonSource {
  return {
    sectionHeading: PROSPECTUS_FINANCIAL_COMPARISON_SECTION_HEADING,
    tableUnitLabel: PROSPECTUS_DATA_NOT_AVAILABLE,
    years: [],
    audit: PROSPECTUS_FINANCIAL_COMPARISON_SOURCE_AUDIT,
  };
}

function resolveFinancialComparisonSource(
  input: ProspectusPageThreeBuilderInput
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
  });
}

export function mapProspectusPageThreeDataToInput(
  data: ProspectusPageThreeLoadedData
): ProspectusPageThreeBuilderInput {
  const { note } = data;
  const isPublished = isProspectusNotePublished(note);
  const parsedPage2 = parseProspectusPageTwoSnapshot(note.prospectus_snapshot);

  let financialMode: ProspectusPageThreeFinancialMode;
  let frozenFinancialComparison: ProspectusPage2FinancialComparisonSnapshot | null = null;
  let liveFinancialStatements: unknown | null = null;

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
  }

  return {
    noteId: note.id,
    isPublished,
    financialMode,
    issuerSnapshot: note.issuer_snapshot,
    invoiceSnapshot: note.invoice_snapshot,
    paymasterSnapshot: note.paymaster_snapshot,
    liveFinancialStatements,
    frozenFinancialComparison,
  };
}

export function buildProspectusPageThree(
  input: ProspectusPageThreeBuilderInput
): ProspectusPageThree {
  const financialSource = resolveFinancialComparisonSource(input);
  const issuer = parseIssuerSnapshot(input.issuerSnapshot);
  const paymaster = parsePaymasterSnapshot(input.paymasterSnapshot);

  const metadata = buildProspectusPageThreeMetadata({
    issuerName: issuer.name,
    issuerSector: issuer.industry,
    selectedRiskRating: parseInvoiceSnapshotRiskRating(input.invoiceSnapshot),
    paymasterName: paymaster.name,
    financialSource,
  });

  const incomeStatement = buildProspectusPageThreeIncomeStatement({ financialSource });
  const balanceSheet = buildProspectusPageThreeBalanceSheet({ financialSource });
  const coverageEfficiency = buildProspectusPageThreeCoverageEfficiency({
    financialSource,
  });
  const trends = buildProspectusPageThreeTrends({
    incomeStatement,
    balanceSheet,
    coverageEfficiency,
  });
  const investorTakeaways = buildProspectusPageThreeInvestorTakeaways({
    metadata,
    incomeStatement,
    balanceSheet,
    coverageEfficiency,
    trends,
  });

  return {
    header: buildProspectusHeader(),
    metadata,
    financialSource,
    incomeStatement,
    balanceSheet,
    coverageEfficiency,
    trends,
    investorTakeaways,
    meta: {
      noteId: input.noteId,
      financialMode: input.financialMode,
      isPublished: input.isPublished,
    },
  };
}

export async function mapProspectusPageThreeFromNote(
  data: ProspectusPageThreeLoadedData
): Promise<ProspectusPageThree> {
  return buildProspectusPageThree(mapProspectusPageThreeDataToInput(data));
}
