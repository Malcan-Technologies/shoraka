/**
 * SECTION: Prospectus Page 1 orchestration
 * WHY: Load Note → map inputs → build stages → assemble Page 1 (Prisma stays out of HTML)
 */

import type { PrismaClient } from "@prisma/client";
import {
  buildProspectusPageOne,
  mapProspectusPageOneDataToInput,
  mapProspectusPageOneFromNote,
} from "./prospectus-page-one-mapper";
import { loadProspectusPageOneNote } from "./prospectus-page-one-prisma";
import type { ProspectusPageOne } from "./prospectus-page-one.types";

export {
  buildProspectusPageOne,
  mapProspectusPageOneDataToInput,
  mapProspectusPageOneFromNote,
};
export {
  isProspectusNotePublished,
  loadProspectusPageOneNote,
  PROSPECTUS_PAGE_ONE_NOTE_SELECT,
} from "./prospectus-page-one-prisma";
export type { ProspectusPageOneNoteRecord } from "./prospectus-page-one-prisma";
export type { ProspectusPageOneBuilderInput } from "./prospectus-page-one-mapper";
export type { ProspectusPageOne, ProspectusPageOneTrackRecordMode } from "./prospectus-page-one.types";
export {
  PROSPECTUS_PAGE_ONE_HEIGHT_MM,
  PROSPECTUS_PAGE_ONE_WIDTH_MM,
} from "./prospectus-page-one.types";

/** Load the Page 1 Note record (Prisma boundary). */
export async function loadProspectusPageOneData(
  db: PrismaClient,
  noteId: string
): Promise<Awaited<ReturnType<typeof loadProspectusPageOneNote>>> {
  return loadProspectusPageOneNote(db, noteId);
}

/** Full pipeline: Prisma load → map → Stage 1–8 assembly. */
export async function buildProspectusPageOneFromNoteId(
  db: PrismaClient,
  noteId: string
): Promise<ProspectusPageOne> {
  const data = await loadProspectusPageOneData(db, noteId);
  return mapProspectusPageOneFromNote(data);
}
