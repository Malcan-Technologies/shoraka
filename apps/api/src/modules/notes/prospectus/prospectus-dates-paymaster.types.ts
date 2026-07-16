/**
 * SECTION: Prospectus Page 1 — Dates and Paymaster (DATA STAGE 2)
 * WHY: Isolate listing/maturity/tenure + paymaster name/entity type
 */

import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

export interface ProspectusDatesPaymaster {
  listingDate: string;
  maturityDate: string;
  tenure: string;
  paymasterName: string;
  paymasterEntityType: string;
}

/** Raw inputs for preview/builder — not Prisma. */
export interface ProspectusDatesPaymasterInput {
  /** note_listings.opens_at */
  listingOpensAt: Date | string | null | undefined;
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
  availability: "stored" | "calculated";
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
    notes: "Investor UI currently shows publishedAt as Published date.",
  },
  maturityDate: {
    label: "Maturity date",
    canonicalSource: "notes.maturity_date",
    availability: "stored",
    possibleAlternatives: "Invoice.details.maturity_date; payment schedule due_date — not used",
    notes: "API: NoteListItem.maturityDate.",
  },
  tenure: {
    label: "Tenure",
    canonicalSource: "calculateCalendarDayCount(note_listings.opens_at, notes.maturity_date)",
    availability: "calculated",
    possibleAlternatives:
      "resolveMarketplaceDaysToMaturity (days left); activated_at→maturity profitDays — not used",
    notes: "UTC whole calendar days. Same span as Canva 15 May → 12 Sept 2025 = 120 days.",
  },
  paymasterName: {
    label: "Paymaster name",
    canonicalSource: "notes.paymaster_snapshot.name",
    availability: "stored",
    possibleAlternatives: "company_name; business_name; live Contract.customer_details — not used",
    notes: "API: NoteListItem.paymasterName uses resolver aliases; prospectus must not.",
  },
  paymasterEntityType: {
    label: "Paymaster entity type",
    canonicalSource: "notes.paymaster_snapshot.entity_type",
    availability: "stored",
    possibleAlternatives: "live Contract.customer_details.entity_type — not used",
    notes:
      "Display-ready labels from issuer ENTITY_TYPES select. No formatting helper. Not on NoteListItem.",
  },
};
