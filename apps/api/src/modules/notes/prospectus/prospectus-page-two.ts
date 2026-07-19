/**
 * SECTION: Prospectus Page 2 orchestration
 * WHY: Load Note → map inputs → build stages → assemble Page 2 (Prisma stays out of HTML)
 */

import type { PrismaClient } from "@prisma/client";
import { mapProspectusPageTwoFromNote } from "./prospectus-page-two-mapper";
import { loadProspectusPageTwoData } from "./prospectus-page-two-prisma";
import type { ProspectusPageTwo } from "./prospectus-page-two.types";

export {
  buildProspectusPageTwo,
  mapProspectusPageTwoDataToInput,
  mapProspectusPageTwoFromNote,
  buildFinancialComparisonSourceFromFrozen,
} from "./prospectus-page-two-mapper";
export type { ProspectusPageTwoBuilderInput } from "./prospectus-page-two-mapper";
export {
  isProspectusNotePublished,
  loadProspectusPageTwoData,
  loadProspectusPageTwoNote,
  PROSPECTUS_PAGE_TWO_NOTE_SELECT,
} from "./prospectus-page-two-prisma";
export type {
  ProspectusPageTwoLoadedData,
  ProspectusPageTwoNoteRecord,
} from "./prospectus-page-two-prisma";
export type {
  ProspectusPageTwo,
  ProspectusPageTwoFinancialMode,
} from "./prospectus-page-two.types";
export {
  PROSPECTUS_PAGE_TWO_HEIGHT_MM,
  PROSPECTUS_PAGE_TWO_WIDTH_MM,
} from "./prospectus-page-two.types";

export async function buildProspectusPageTwoFromNoteId(
  db: PrismaClient,
  noteId: string
): Promise<ProspectusPageTwo> {
  const data = await loadProspectusPageTwoData(db, noteId);
  return mapProspectusPageTwoFromNote(data);
}
