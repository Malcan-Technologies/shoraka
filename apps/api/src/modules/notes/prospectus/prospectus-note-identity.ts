/**
 * SECTION: Build Note Identity view-model
 * WHY: Raw NOTE reference; presentation-only uppercase financing type; frozen description
 */

import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_INVESTMENT_NOTE_LABEL,
  type ProspectusNoteIdentity,
  type ProspectusNoteIdentityInput,
} from "./prospectus-note-identity.types";

function nonEmptyString(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Presentation-only uppercase for Canva financing type. Does not mutate stored snapshot. */
export function formatProspectusFinancingTypeDisplay(
  productName: string | null | undefined
): string {
  const value = nonEmptyString(productName);
  if (!value) return PROSPECTUS_DATA_NOT_AVAILABLE;
  return value.toUpperCase();
}

export function buildProspectusNoteIdentity(
  input: ProspectusNoteIdentityInput
): ProspectusNoteIdentity {
  // Observational live Product description must never become a render fallback.
  void input.liveProductDescription;

  const noteReference = nonEmptyString(input.noteReference);
  const description = nonEmptyString(input.productSnapshotDescription);

  return {
    investmentNoteLabel: PROSPECTUS_INVESTMENT_NOTE_LABEL,
    noteReference: noteReference ?? PROSPECTUS_DATA_NOT_AVAILABLE,
    financingType: formatProspectusFinancingTypeDisplay(input.productSnapshotProductName),
    description: description ?? PROSPECTUS_DATA_NOT_AVAILABLE,
  };
}
