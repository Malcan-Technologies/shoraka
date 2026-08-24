/**
 * SECTION: Build Dates & Paymaster view-model from raw inputs
 * WHY: Pure formatting/calculation for Stage 2 — no Prisma; no closing-date fallbacks
 */

import { isTenureBackedNote } from "@cashsouk/types";
import { calculateCalendarDayCount } from "../calculators";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  type ProspectusDatesPaymaster,
  type ProspectusDatesPaymasterInput,
} from "./prospectus-dates-paymaster.types";

function toValidDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function nonEmptyString(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Date-only display in en-MY style using UTC calendar parts (avoids TZ day shift). */
export function formatProspectusDateUtc(value: Date | string | null | undefined): string {
  const date = toValidDate(value);
  if (!date) return PROSPECTUS_DATA_NOT_AVAILABLE;
  return new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/**
 * Shared tenure + maturity + listing display for Stage 2 and later stages.
 * New notes: tenure = stored tenure_days; maturity = date after activation, else
 * "{n} days from disbursement". Legacy notes keep opens_at → maturity_date.
 */
export function buildProspectusTenureAndMaturity(input: {
  listingOpensAt: Date | string | null | undefined;
  maturityDate: Date | string | null | undefined;
  tenureDays?: number | null;
}): { tenure: string; maturityDate: string; listingDate: string } {
  const opensAt = toValidDate(input.listingOpensAt);
  const maturity = toValidDate(input.maturityDate);
  const tenureDays = isTenureBackedNote(input.tenureDays) ? input.tenureDays : null;

  let tenure = PROSPECTUS_DATA_NOT_AVAILABLE;
  if (tenureDays != null) {
    tenure = `${tenureDays} days`;
  } else if (opensAt && maturity) {
    tenure = `${calculateCalendarDayCount(opensAt, maturity)} days`;
  }

  return {
    listingDate: formatProspectusDateUtc(opensAt),
    maturityDate:
      tenureDays != null && !maturity
        ? `${tenureDays} days from disbursement`
        : formatProspectusDateUtc(maturity),
    tenure,
  };
}

/** Maturity with optional tenure suffix; no empty parentheses. */
export function composeProspectusMaturityDateWithTenure(
  maturityDate: string,
  tenure: string
): string {
  if (maturityDate === PROSPECTUS_DATA_NOT_AVAILABLE) {
    return PROSPECTUS_DATA_NOT_AVAILABLE;
  }
  if (maturityDate.includes("from disbursement")) {
    return maturityDate;
  }
  if (tenure === PROSPECTUS_DATA_NOT_AVAILABLE) {
    return maturityDate;
  }
  return `${maturityDate} (${tenure})`;
}

/**
 * Closing Date display with listing-window duration when opens_at + closes_at exist.
 * Duration uses stored closes_at (canonical portal source) — never invents +14 on read.
 */
export function composeProspectusClosingDateWithDuration(
  closingDate: string,
  listingWindowDays: string | null
): string {
  if (closingDate === PROSPECTUS_DATA_NOT_AVAILABLE) {
    return PROSPECTUS_DATA_NOT_AVAILABLE;
  }
  if (!listingWindowDays) return closingDate;
  return `${closingDate} (${listingWindowDays})`;
}

/** Paymaster line; entity type never shown without name; values not shortened. */
export function composeProspectusPaymasterDisplay(
  paymasterName: string | null | undefined,
  paymasterEntityType: string | null | undefined
): string {
  const name = nonEmptyString(paymasterName);
  if (!name) return PROSPECTUS_DATA_NOT_AVAILABLE;
  const entityType = nonEmptyString(paymasterEntityType);
  if (!entityType) return name;
  return `${name} (${entityType})`;
}

export function buildProspectusDatesPaymaster(
  input: ProspectusDatesPaymasterInput
): ProspectusDatesPaymaster {
  const timing = buildProspectusTenureAndMaturity({
    listingOpensAt: input.listingOpensAt,
    maturityDate: input.maturityDate,
    tenureDays: input.tenureDays,
  });
  const opensAt = toValidDate(input.listingOpensAt);
  const closesAt = toValidDate(input.listingClosesAt);
  const closingDateOnly = formatProspectusDateUtc(closesAt);
  let listingWindowDays: string | null = null;
  if (opensAt && closesAt) {
    listingWindowDays = `${calculateCalendarDayCount(opensAt, closesAt)} days`;
  }
  const closingDate = composeProspectusClosingDateWithDuration(
    closingDateOnly,
    listingWindowDays
  );
  const paymasterName = nonEmptyString(input.paymasterName);
  const paymasterEntityType = nonEmptyString(input.paymasterEntityType);

  return {
    listingDate: timing.listingDate,
    closingDate,
    maturityDate: timing.maturityDate,
    tenure: timing.tenure,
    maturityDateWithTenure: composeProspectusMaturityDateWithTenure(
      timing.maturityDate,
      timing.tenure
    ),
    paymasterName: paymasterName ?? PROSPECTUS_DATA_NOT_AVAILABLE,
    paymasterEntityType: paymasterEntityType ?? PROSPECTUS_DATA_NOT_AVAILABLE,
    paymasterDisplay: composeProspectusPaymasterDisplay(
      input.paymasterName,
      input.paymasterEntityType
    ),
  };
}
