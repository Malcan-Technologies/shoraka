/**
 * SECTION: Build Issuer Track-Record Summary view-model
 * WHY: Format Stage 7 metrics from frozen snapshot or live computed aggregates
 */

import { formatInvestorReturnRatePercent } from "@cashsouk/types";
import { formatProspectusMoneyMyr } from "./prospectus-main-financial-terms";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_ISSUER_TRACK_RECORD_CURRENT_NOTE_EXCLUSION_KEY,
  PROSPECTUS_ISSUER_TRACK_RECORD_IDENTITY_SOURCE,
  PROSPECTUS_ISSUER_TRACK_RECORD_SECTION_HEADING,
  PROSPECTUS_ON_TIME_PAYMENT_RATE_LABEL,
  type ProspectusIssuerTrackRecord,
  type ProspectusIssuerTrackRecordMetricsInput,
} from "./prospectus-issuer-track-record.types";
import type { ProspectusPage1IssuerTrackRecordSnapshot } from "./prospectus-snapshot.types";

function formatPercentOrDna(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return PROSPECTUS_DATA_NOT_AVAILABLE;
  const label = formatInvestorReturnRatePercent(value);
  if (label === "-") return PROSPECTUS_DATA_NOT_AVAILABLE;
  return label;
}

function formatCountOrDna(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return PROSPECTUS_DATA_NOT_AVAILABLE;
  return String(value);
}

export function buildProspectusIssuerTrackRecordFromMetrics(
  input: ProspectusIssuerTrackRecordMetricsInput
): ProspectusIssuerTrackRecord {
  let totalAmountFunded = PROSPECTUS_DATA_NOT_AVAILABLE;
  if (typeof input.totalAmountFunded === "number" && Number.isFinite(input.totalAmountFunded)) {
    totalAmountFunded = formatProspectusMoneyMyr(input.totalAmountFunded);
  } else if (typeof input.totalAmountFunded === "string" && input.totalAmountFunded.trim() !== "") {
    const parsed = Number(input.totalAmountFunded);
    totalAmountFunded = Number.isFinite(parsed)
      ? formatProspectusMoneyMyr(parsed)
      : PROSPECTUS_DATA_NOT_AVAILABLE;
  }

  const isFrozen = input.isFrozen === true;

  return {
    sectionHeading: PROSPECTUS_ISSUER_TRACK_RECORD_SECTION_HEADING,
    totalNotesFunded: formatCountOrDna(input.totalNotesFunded),
    totalAmountFunded,
    successfulRepayment: formatPercentOrDna(input.successfulRepaymentPercent),
    onTimePaymentRate: formatPercentOrDna(input.onTimePaymentRateSixMonthsPercent),
    onTimePaymentRateLabel: PROSPECTUS_ON_TIME_PAYMENT_RATE_LABEL,
    audit: {
      issuer: {
        groupingKey: PROSPECTUS_ISSUER_TRACK_RECORD_IDENTITY_SOURCE,
        currentNoteExclusionKey: PROSPECTUS_ISSUER_TRACK_RECORD_CURRENT_NOTE_EXCLUSION_KEY,
        currentNoteExcluded: true,
      },
      eligibility: {
        statuses: ["ACTIVE", "REPAID", "ARREARS", "DEFAULTED"],
      },
      snapshot: {
        isFrozen,
        snapshotDecision: isFrozen ? "frozen_at_publish" : "live_preview",
      },
    },
  };
}

export function buildProspectusIssuerTrackRecordFromSnapshot(
  snapshot: ProspectusPage1IssuerTrackRecordSnapshot | null | undefined
): ProspectusIssuerTrackRecord {
  if (!snapshot) {
    return buildProspectusIssuerTrackRecordFromMetrics({
      totalNotesFunded: null,
      totalAmountFunded: null,
      successfulRepaymentPercent: null,
      onTimePaymentRateSixMonthsPercent: null,
      isFrozen: false,
    });
  }

  return buildProspectusIssuerTrackRecordFromMetrics({
    totalNotesFunded: snapshot.total_notes_funded,
    totalAmountFunded: snapshot.total_amount_funded,
    successfulRepaymentPercent: snapshot.successful_repayment_percent,
    onTimePaymentRateSixMonthsPercent: snapshot.on_time_payment_rate_six_months_percent,
    isFrozen: true,
  });
}

/** @deprecated Prefer FromMetrics / FromSnapshot — kept for sample preview wiring. */
export function buildProspectusIssuerTrackRecord(
  input: ProspectusIssuerTrackRecordMetricsInput = {
    totalNotesFunded: null,
    totalAmountFunded: null,
    successfulRepaymentPercent: null,
    onTimePaymentRateSixMonthsPercent: null,
  }
): ProspectusIssuerTrackRecord {
  return buildProspectusIssuerTrackRecordFromMetrics(input);
}
