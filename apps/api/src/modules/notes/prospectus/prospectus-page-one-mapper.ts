/**
 * SECTION: Map loaded Note → Stage builder inputs → ProspectusPageOne
 * WHY: Snapshot preference for Stage 7/8; frozen create snapshots for Stage 1/4B
 */

import { decimalToNumber } from "../../issuer-dashboard/track-record-aggregates";
import { PROSPECTUS_AT_A_GLANCE_AUDIT, type ProspectusAtAGlance } from "./prospectus-at-a-glance.types";
import { buildProspectusDatesPaymaster } from "./prospectus-dates-paymaster";
import type { ProspectusDatesPaymasterInput } from "./prospectus-dates-paymaster.types";
import { buildProspectusHistoricalNoteTableFromSnapshot } from "./prospectus-historical-note-table";
import {
  PROSPECTUS_HISTORICAL_NOTE_EMPTY_STATE,
  type ProspectusHistoricalNoteTable,
} from "./prospectus-historical-note-table.types";
import { buildProspectusIssuerFundamentalsHighlight } from "./prospectus-issuer-fundamentals-highlight";
import type { ProspectusIssuerFundamentalsHighlightInput } from "./prospectus-issuer-fundamentals-highlight.types";
import {
  buildProspectusIssuerTrackRecordFromMetrics,
  buildProspectusIssuerTrackRecordFromSnapshot,
} from "./prospectus-issuer-track-record";
import type { ProspectusIssuerTrackRecord } from "./prospectus-issuer-track-record.types";
import {
  parseInvoiceSnapshotRiskRating,
  parsePaymasterSnapshot,
  parseProductSnapshot,
  parseProspectusPageOneSnapshot,
  parsePurposeSnapshot,
} from "./prospectus-json-guards";
import { buildProspectusMainFinancialTerms } from "./prospectus-main-financial-terms";
import type { ProspectusMainFinancialTermsInput } from "./prospectus-main-financial-terms.types";
import { buildProspectusNoteIdentity } from "./prospectus-note-identity";
import type { ProspectusNoteIdentityInput } from "./prospectus-note-identity.types";
import {
  isProspectusNotePublished,
  type ProspectusPageOneNoteRecord,
} from "./prospectus-page-one-prisma";
import { publicationContentFromFrozenSnapshot } from "../prospectus-review/prospectus-frozen-publication";
import type {
  ProspectusPageOne,
  ProspectusPageOneTrackRecordMode,
} from "./prospectus-page-one.types";
import { buildProspectusPaymasterHighlight } from "./prospectus-paymaster-highlight";
import type { ProspectusPaymasterHighlightInput } from "./prospectus-paymaster-highlight.types";
import { buildProspectusPaymentBasisShariah } from "./prospectus-payment-basis-shariah";
import type { ProspectusPaymentBasisShariahInput } from "./prospectus-payment-basis-shariah.types";
import { buildProspectusReturnHighlight } from "./prospectus-return-highlight";
import type { ProspectusReturnHighlightInput } from "./prospectus-return-highlight.types";
import { buildProspectusRiskAssessment } from "./prospectus-risk-assessment";
import type { ProspectusRiskAssessmentInput } from "./prospectus-risk-assessment.types";
import {
  PROSPECTUS_SHARIAH_HIGHLIGHT_AUDIT,
  type ProspectusShariahHighlight,
} from "./prospectus-shariah-highlight.types";
import { buildProspectusTimingPurpose } from "./prospectus-timing-purpose";
import type { ProspectusTimingPurposeInput } from "./prospectus-timing-purpose.types";
import { buildProspectusPage1TrackRecordSnapshot } from "./prospectus-track-record-query";
import type { ProspectusPage1Snapshot } from "./prospectus-snapshot.types";
import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export interface ProspectusPageOneBuilderInput {
  noteId: string;
  noteIdentity: ProspectusNoteIdentityInput;
  datesPaymaster: ProspectusDatesPaymasterInput;
  riskAssessment: ProspectusRiskAssessmentInput;
  mainFinancialTerms: ProspectusMainFinancialTermsInput;
  timingPurpose: ProspectusTimingPurposeInput;
  paymentBasisShariah: ProspectusPaymentBasisShariahInput;
  paymasterHighlight: ProspectusPaymasterHighlightInput;
  issuerFundamentalsHighlight: ProspectusIssuerFundamentalsHighlightInput;
  returnHighlight: ProspectusReturnHighlightInput;
  trackRecordMode: ProspectusPageOneTrackRecordMode;
  /** Frozen or live Stage 7/8 snapshot payload (null = published unavailable). */
  page1TrackRecordSnapshot: ProspectusPage1Snapshot | null;
  /**
   * Preview/development publication placeholders only.
   * Prisma Note mapping must leave this undefined.
   */
  publicationContent?: import("./prospectus-placeholder-publication-content").ProspectusPublicationContent;
}

function unavailableTrackRecord(): ProspectusIssuerTrackRecord {
  return buildProspectusIssuerTrackRecordFromMetrics({
    totalNotesFunded: null,
    totalAmountFunded: null,
    successfulRepaymentPercent: null,
    onTimePaymentRateSixMonthsPercent: null,
    isFrozen: true,
  });
}

function unavailableHistoricalTable(): ProspectusHistoricalNoteTable {
  return {
    rows: [],
    emptyStateMessage: PROSPECTUS_HISTORICAL_NOTE_EMPTY_STATE,
    audit: {
      identity: {
        issuerGroupingKey: "notes.issuer_organization_id",
        currentNoteExclusionKey: "notes.id",
        currentNoteExclusionRequired: true,
      },
      eligibility: {
        statuses: ["ACTIVE", "REPAID", "ARREARS", "DEFAULTED"],
        sort: "updated_at DESC",
        rowLimit: 4,
      },
      snapshot: {
        isFrozen: true,
        snapshotDecision: "frozen_at_publish",
      },
    },
  };
}

async function resolvePage1TrackRecordSnapshot(
  note: ProspectusPageOneNoteRecord
): Promise<{
  trackRecordMode: ProspectusPageOneTrackRecordMode;
  page1TrackRecordSnapshot: ProspectusPage1Snapshot | null;
}> {
  const published = isProspectusNotePublished(note);
  const snapshot = parseProspectusPageOneSnapshot(note.prospectus_snapshot);

  if (published) {
    if (!snapshot) {
      return {
        trackRecordMode: "published_unavailable",
        page1TrackRecordSnapshot: null,
      };
    }
    return {
      trackRecordMode: "frozen_publication_snapshot",
      page1TrackRecordSnapshot: snapshot.page_1,
    };
  }

  const live = await buildProspectusPage1TrackRecordSnapshot({
    issuerOrganizationId: note.issuer_organization_id,
    currentNoteId: note.id,
  });

  return {
    trackRecordMode: "live_unpublished_preview",
    page1TrackRecordSnapshot: live,
  };
}

/**
 * Normalize Prisma Note JSON/decimals into Stage builder inputs.
 * Does not execute Stage builders.
 */
export async function mapProspectusPageOneDataToInput(
  note: ProspectusPageOneNoteRecord
): Promise<ProspectusPageOneBuilderInput> {
  const product = parseProductSnapshot(note.product_snapshot);
  const paymaster = parsePaymasterSnapshot(note.paymaster_snapshot);
  const purpose = parsePurposeSnapshot(note.purpose_snapshot);
  const riskRating = parseInvoiceSnapshotRiskRating(note.invoice_snapshot);

  const listingOpensAt = note.listing?.opens_at ?? null;
  const listingClosesAt = note.listing?.closes_at ?? null;
  const maturityDate = note.maturity_date;
  const profitRatePercent =
    note.profit_rate_percent == null ? null : decimalToNumber(note.profit_rate_percent);
  const serviceFeeRatePercent =
    note.service_fee_rate_percent == null
      ? null
      : decimalToNumber(note.service_fee_rate_percent);
  const targetAmount =
    note.target_amount == null ? null : decimalToNumber(note.target_amount);

  const track = await resolvePage1TrackRecordSnapshot(note);

  return {
    noteId: note.id,
    noteIdentity: {
      noteReference: note.note_reference,
      productSnapshotProductName: product.productName,
      productSnapshotDescription: product.description,
      liveProductDescription: null,
    },
    datesPaymaster: {
      listingOpensAt,
      listingClosesAt,
      maturityDate,
      tenureDays: note.tenure_days,
      paymasterName: paymaster.name,
      paymasterEntityType: paymaster.entityType,
    },
    riskAssessment: {
      soukscoreRiskRating: riskRating,
    },
    mainFinancialTerms: {
      targetAmount,
      profitRatePercent,
      serviceFeeRatePercent,
    },
    timingPurpose: {
      listingOpensAt,
      maturityDate,
      tenureDays: note.tenure_days,
      purposeSnapshotFinancingFor: purpose?.financing_for ?? null,
      liveApplicationFinancingFor: null,
    },
    paymentBasisShariah: {},
    paymasterHighlight: {
      paymasterName: paymaster.name,
      paymasterEntityType: paymaster.entityType,
    },
    issuerFundamentalsHighlight: {
      financialYearsAvailable: [],
    },
    returnHighlight: {
      profitRatePercent,
      listingOpensAt,
      maturityDate,
      tenureDays: note.tenure_days,
      serviceFeeRatePercent,
    },
    trackRecordMode: track.trackRecordMode,
    page1TrackRecordSnapshot: track.page1TrackRecordSnapshot,
    /** Published Notes: frozen officer content only — never mutable draft / placeholders. */
    publicationContent: isProspectusNotePublished(note)
      ? publicationContentFromFrozenSnapshot(note.prospectus_snapshot)
      : undefined,
  };
}

function buildAtAGlanceFromStages(
  mainFinancialTerms: ReturnType<typeof buildProspectusMainFinancialTerms>,
  datesPaymaster: ReturnType<typeof buildProspectusDatesPaymaster>
): ProspectusAtAGlance {
  return {
    financingAmount: mainFinancialTerms.financingAmount,
    profitRate: mainFinancialTerms.profitRate,
    expectedReturn: mainFinancialTerms.expectedReturnForInvestmentPeriod,
    tenure: datesPaymaster.tenure,
    minimumInvestment: mainFinancialTerms.minimumInvestment,
    audit: PROSPECTUS_AT_A_GLANCE_AUDIT,
  };
}

function buildShariahHighlightFromStage4c(
  paymentBasisShariah: ReturnType<typeof buildProspectusPaymentBasisShariah>
): ProspectusShariahHighlight {
  return {
    shariahCompliantStatus: PROSPECTUS_DATA_NOT_AVAILABLE,
    specificShariahPrinciple: paymentBasisShariah.shariahPrinciple,
    evidenceSource: PROSPECTUS_DATA_NOT_AVAILABLE,
    approvalOrAdviserReference: PROSPECTUS_DATA_NOT_AVAILABLE,
    highlightTitle: PROSPECTUS_DATA_NOT_AVAILABLE,
    highlightExplanation: PROSPECTUS_DATA_NOT_AVAILABLE,
    audit: PROSPECTUS_SHARIAH_HIGHLIGHT_AUDIT,
  };
}

function buildTrackRecordSections(
  mode: ProspectusPageOneTrackRecordMode,
  snapshot: ProspectusPage1Snapshot | null
): {
  issuerTrackRecord: ProspectusIssuerTrackRecord;
  historicalNoteTable: ProspectusHistoricalNoteTable;
} {
  if (mode === "published_unavailable" || snapshot == null) {
    return {
      issuerTrackRecord: unavailableTrackRecord(),
      historicalNoteTable: unavailableHistoricalTable(),
    };
  }

  if (mode === "live_unpublished_preview") {
    const historicalNoteTable = buildProspectusHistoricalNoteTableFromSnapshot(
      snapshot.historical_notes
    );
    historicalNoteTable.audit.snapshot = {
      isFrozen: false,
      snapshotDecision: "live_preview",
    };
    return {
      issuerTrackRecord: buildProspectusIssuerTrackRecordFromMetrics({
        totalNotesFunded: snapshot.issuer_track_record.total_notes_funded,
        totalAmountFunded: snapshot.issuer_track_record.total_amount_funded,
        successfulRepaymentPercent:
          snapshot.issuer_track_record.successful_repayment_percent,
        onTimePaymentRateSixMonthsPercent:
          snapshot.issuer_track_record.on_time_payment_rate_six_months_percent,
        isFrozen: false,
      }),
      historicalNoteTable,
    };
  }

  return {
    issuerTrackRecord: buildProspectusIssuerTrackRecordFromSnapshot(
      snapshot.issuer_track_record
    ),
    historicalNoteTable: buildProspectusHistoricalNoteTableFromSnapshot(
      snapshot.historical_notes
    ),
  };
}

/**
 * Run Stage 1–8 builders from normalized inputs and assemble Page 1.
 */
export function buildProspectusPageOne(
  input: ProspectusPageOneBuilderInput
): ProspectusPageOne {
  const noteIdentity = buildProspectusNoteIdentity(input.noteIdentity);
  const datesPaymaster = buildProspectusDatesPaymaster(input.datesPaymaster);
  const riskAssessment = buildProspectusRiskAssessment(input.riskAssessment);
  const publication = input.publicationContent;
  const mainFinancialTerms = buildProspectusMainFinancialTerms(input.mainFinancialTerms);
  const timingPurpose = buildProspectusTimingPurpose(input.timingPurpose);
  const paymentBasisShariah = buildProspectusPaymentBasisShariah({
    ...input.paymentBasisShariah,
    paymentBasisTemplate: publication?.paymentBasisTemplate,
  });
  const paymasterHighlight = buildProspectusPaymasterHighlight(input.paymasterHighlight);
  const issuerFundamentalsHighlight = buildProspectusIssuerFundamentalsHighlight(
    input.issuerFundamentalsHighlight
  );
  const returnHighlight = buildProspectusReturnHighlight(input.returnHighlight);
  let shariahHighlight = buildShariahHighlightFromStage4c(paymentBasisShariah);

  if (publication) {
    const byKey = new Map(
      publication.keyInvestorHighlights.map((h) => [h.key, h] as const)
    );
    const applyHighlight = <T extends { highlightTitle: string; highlightExplanation: string }>(
      current: T,
      key: string
    ): T => {
      const hit = byKey.get(key);
      // Key Investor Highlights are always displayed when publication content is present.
      if (!hit) return current;
      const title = hit.title?.trim() ?? "";
      const description = hit.description?.trim() ?? "";
      if (!title && !description) return current;
      return {
        ...current,
        highlightTitle: title || current.highlightTitle,
        highlightExplanation: description || current.highlightExplanation,
      };
    };
    Object.assign(paymasterHighlight, applyHighlight(paymasterHighlight, "paymaster"));
    Object.assign(
      issuerFundamentalsHighlight,
      applyHighlight(issuerFundamentalsHighlight, "issuer_fundamentals")
    );
    Object.assign(returnHighlight, applyHighlight(returnHighlight, "return"));
    shariahHighlight = applyHighlight(shariahHighlight, "shariah");
  }
  const atAGlance = buildAtAGlanceFromStages(mainFinancialTerms, datesPaymaster);
  const track = buildTrackRecordSections(
    input.trackRecordMode,
    input.page1TrackRecordSnapshot
  );

  return {
    noteIdentity,
    datesPaymaster,
    riskAssessment,
    mainFinancialTerms,
    timingPurpose,
    paymentBasisShariah,
    paymasterHighlight,
    issuerFundamentalsHighlight,
    returnHighlight,
    shariahHighlight,
    atAGlance,
    issuerTrackRecord: track.issuerTrackRecord,
    historicalNoteTable: track.historicalNoteTable,
    meta: {
      noteId: input.noteId,
      trackRecordMode: input.trackRecordMode,
    },
  };
}

/**
 * Map a loaded Note record through Stage builders into ProspectusPageOne.
 */
export async function mapProspectusPageOneFromNote(
  note: ProspectusPageOneNoteRecord
): Promise<ProspectusPageOne> {
  const input = await mapProspectusPageOneDataToInput(note);
  return buildProspectusPageOne(input);
}
