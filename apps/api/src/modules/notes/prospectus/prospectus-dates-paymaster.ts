/**
 * SECTION: Build Dates & Paymaster view-model from raw inputs
 * WHY: Pure formatting/calculation for Stage 2 — no Prisma; no closing-date fallbacks
 */

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
 * Tenure = calculateCalendarDayCount(opens_at, maturity_date) → "{n} days".
 */
export function buildProspectusTenureAndMaturity(input: {
  listingOpensAt: Date | string | null | undefined;
  maturityDate: Date | string | null | undefined;
}): { tenure: string; maturityDate: string; listingDate: string } {
  const opensAt = toValidDate(input.listingOpensAt);
  const maturity = toValidDate(input.maturityDate);

  let tenure = PROSPECTUS_DATA_NOT_AVAILABLE;
  if (opensAt && maturity) {
    const days = calculateCalendarDayCount(opensAt, maturity);
    tenure = `${days} days`;
  }

  return {
    listingDate: formatProspectusDateUtc(opensAt),
    maturityDate: formatProspectusDateUtc(maturity),
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
  if (tenure === PROSPECTUS_DATA_NOT_AVAILABLE) {
    return maturityDate;
  }
  return `${maturityDate} (${tenure})`;
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
  });
  const closingDate = formatProspectusDateUtc(input.listingClosesAt);
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
