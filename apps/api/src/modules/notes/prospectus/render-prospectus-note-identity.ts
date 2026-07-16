/**
 * SECTION: Note Identity HTML orchestration
 * WHY: Data preview only — no Prisma mapper, S3, or routes
 */

import { SAMPLE_PROSPECTUS_NOTE_IDENTITY } from "./prospectus-note-identity.sample-data";
import { buildProspectusNoteIdentityHtml } from "./prospectus-note-identity.html";
import type { ProspectusNoteIdentity } from "./prospectus-note-identity.types";

export function buildProspectusNoteIdentityDocument(
  identity: ProspectusNoteIdentity = SAMPLE_PROSPECTUS_NOTE_IDENTITY
): string {
  return buildProspectusNoteIdentityHtml(identity);
}
