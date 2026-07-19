/**
 * SECTION: Prospectus Page 3 orchestration (Prisma → mapper → assembled page)
 * WHY: Single entry for preview/render; Prisma stays out of HTML
 */

import type { PrismaClient } from "@prisma/client";
import { mapProspectusPageThreeFromNote } from "./prospectus-page-three-mapper";
import { loadProspectusPageThreeData } from "./prospectus-page-three-prisma";
import type { ProspectusPageThree } from "./prospectus-page-three.types";

export {
  buildProspectusPageThree,
  mapProspectusPageThreeDataToInput,
  mapProspectusPageThreeFromNote,
} from "./prospectus-page-three-mapper";
export {
  isProspectusNotePublished,
  loadProspectusPageThreeData,
  loadProspectusPageThreeNote,
  PROSPECTUS_PAGE_THREE_NOTE_SELECT,
} from "./prospectus-page-three-prisma";
export type {
  ProspectusPageThree,
  ProspectusPageThreeFinancialMode,
} from "./prospectus-page-three.types";
export {
  PROSPECTUS_PAGE_THREE_HEIGHT_MM,
  PROSPECTUS_PAGE_THREE_WIDTH_MM,
} from "./prospectus-page-three.types";

export async function buildProspectusPageThreeFromNoteId(
  db: PrismaClient,
  noteId: string
): Promise<ProspectusPageThree> {
  const data = await loadProspectusPageThreeData(db, noteId);
  return mapProspectusPageThreeFromNote(data);
}
