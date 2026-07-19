/**
 * SECTION: Build Payment Basis & Shariah Principle view-model
 * WHY: Always Data not available — observe schedule/Tawarruq only for audit, never infer labels
 */

import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  type ProspectusPaymentBasisShariah,
  type ProspectusPaymentBasisShariahInput,
  type ProspectusScheduleShapeObserved,
} from "./prospectus-payment-basis-shariah.types";

function toValidDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function sameUtcCalendarDay(left: Date, right: Date): boolean {
  return (
    left.getUTCFullYear() === right.getUTCFullYear() &&
    left.getUTCMonth() === right.getUTCMonth() &&
    left.getUTCDate() === right.getUTCDate()
  );
}

/** Observational only — never maps to a Canva-facing payment-basis label. */
export function observeProspectusScheduleShape(
  input: ProspectusPaymentBasisShariahInput
): ProspectusScheduleShapeObserved {
  const schedules = input.paymentSchedules;
  if (schedules == null) return "not_provided";
  if (schedules.length === 0) return "none";
  if (schedules.length > 1) return "multiple_schedules";

  const only = schedules[0];
  const due = toValidDate(only?.dueDate);
  const maturity = toValidDate(input.maturityDate);
  const sequenceOk = only?.sequence == null || only.sequence === 1;
  if (sequenceOk && due && maturity && sameUtcCalendarDay(due, maturity)) {
    return "single_maturity_schedule";
  }
  return "other_schedule_shape";
}

export function buildProspectusPaymentBasisShariah(
  input: ProspectusPaymentBasisShariahInput = {}
): ProspectusPaymentBasisShariah {
  // Intentional: schedule / Tawarruq / murabaha / marketing inputs are ignored for Canva values.
  void input.tawarruqStatus;
  void input.commodityType;
  void input.murabahaAmount;
  void input.financingStructure;
  void input.marketingShariahCompliantLabel;

  return {
    paymentBasis: PROSPECTUS_DATA_NOT_AVAILABLE,
    shariahPrinciple: PROSPECTUS_DATA_NOT_AVAILABLE,
    audit: {
      paymentBasis: {
        sourceStatus: "not_stored",
        inferenceAllowed: false,
        scheduleShapeObserved: observeProspectusScheduleShape(input),
        businessDecision: "pending",
        snapshotStatus: "not_available",
      },
      shariahPrinciple: {
        sourceStatus: "not_stored",
        inferenceAllowed: false,
        tawarruqUsedAsEvidence: false,
        legalDecision: "pending",
        adviserApprovalReference: "unavailable",
        snapshotStatus: "not_available",
      },
    },
  };
}
