/**
 * SECTION: Prospectus Page 1 — Dates and Paymaster (DATA STAGE 2)
 * WHY: Listing/closing/maturity/tenure + paymaster; Closing Date is a template extension
 */

import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

/**
 * Separate source fields plus Canva-facing composed displays.
 * Closing Date = scheduled listing close (not actual funding_closed_at).
 */
export interface ProspectusDatesPaymaster {
  listingDate: string;
  closingDate: string;
  maturityDate: string;
  tenure: string;
  /** Maturity with tenure when both available: "12 September 2025 (120 days)" */
  maturityDateWithTenure: string;
  paymasterName: string;
  paymasterEntityType: string;
  /** Name (entity type) when name exists; name alone; or Data not available */
  paymasterDisplay: string;
}

/** Raw inputs for preview/builder — not Prisma. */
export interface ProspectusDatesPaymasterInput {
  /** note_listings.opens_at */
  listingOpensAt: Date | string | null | undefined;
  /**
   * note_listings.closes_at — scheduled listing closing date only.
   * Do not pass notes.funding_closed_at; it is not used as a fallback.
   */
  listingClosesAt: Date | string | null | undefined;
  /** notes.maturity_date */
  maturityDate: Date | string | null | undefined;
  /** notes.paymaster_snapshot.name */
  paymasterName: string | null | undefined;
  /** notes.paymaster_snapshot.entity_type */
  paymasterEntityType: string | null | undefined;
}

export interface ProspectusDatesPaymasterFieldSource {
  label: string;
  canonicalSource: string;
  availability: "stored" | "calculated" | "composed";
  possibleAlternatives: string;
  notes: string;
}

export const PROSPECTUS_DATES_PAYMASTER_FIELD_SOURCES: Record<
  keyof ProspectusDatesPaymaster,
  ProspectusDatesPaymasterFieldSource
> = {
  listingDate: {
    label: "Listing date",
    canonicalSource: "note_listings.opens_at",
    availability: "stored",
    possibleAlternatives: "note_listings.published_at; notes.published_at — not used",
    notes: "Listing open for investors.",
  },
  closingDate: {
    label: "Closing Date",
    canonicalSource: "note_listings.closes_at",
    availability: "stored",
    possibleAlternatives:
      "notes.funding_closed_at (actual funding close); notes.activated_at — not used",
    notes:
      "Scheduled investment/listing commitment deadline. Display order: Listing Date → Closing Date → Maturity Date → Paymaster. funding_closed_at is never a fallback.",
  },
  maturityDate: {
    label: "Maturity date",
    canonicalSource: "notes.maturity_date",
    availability: "stored",
    possibleAlternatives: "Invoice.details.maturity_date; payment schedule due_date — not used",
    notes: "Date-only source field. Prefer maturityDateWithTenure for Canva-facing meta.",
  },
  tenure: {
    label: "Tenure",
    canonicalSource: "calculateCalendarDayCount(note_listings.opens_at, notes.maturity_date)",
    availability: "calculated",
    possibleAlternatives:
      "resolveMarketplaceDaysToMaturity (days left); activated_at→maturity profitDays — not used",
    notes: "UTC whole calendar days via buildProspectusTenureAndMaturity.",
  },
  maturityDateWithTenure: {
    label: "Maturity date (with tenure)",
    canonicalSource: "notes.maturity_date + tenure composition",
    availability: "composed",
    possibleAlternatives: "none",
    notes: "\"{maturity} ({tenure})\" when both available; maturity alone if tenure missing; DNA if maturity missing.",
  },
  paymasterName: {
    label: "Paymaster name",
    canonicalSource: "notes.paymaster_snapshot.name",
    availability: "stored",
    possibleAlternatives: "company_name; business_name; live Contract.customer_details — not used",
    notes: "No name aliases. Prefer paymasterDisplay for Canva-facing meta.",
  },
  paymasterEntityType: {
    label: "Paymaster entity type",
    canonicalSource: "notes.paymaster_snapshot.entity_type",
    availability: "stored",
    possibleAlternatives: "live Contract.customer_details.entity_type — not used",
    notes: "Display-ready ENTITY_TYPES strings. Never shown alone.",
  },
  paymasterDisplay: {
    label: "Paymaster",
    canonicalSource: "paymaster_snapshot.name + entity_type composition",
    availability: "composed",
    possibleAlternatives: "none",
    notes: "\"{name} ({entity_type})\" when both exist; name alone if type missing; DNA if name missing.",
  },
};
