/**
 * SECTION: Render Prospectus pages from an approved snapshot
 * WHY: Approve, GET, preview and publish must show the approved result. Page 2 / Page 3 come
 * from the frozen page_2 only (no application / CTOS read, no source or year selection);
 * Page 1 uses the frozen track record.
 */

import { AppError } from "../../../lib/http/error-handler";
import { prisma } from "../../../lib/prisma";
import { parseProspectusPageTwoFinancialComparison } from "../prospectus/prospectus-json-guards";
import { resolveMarcSnapshotForProspectus } from "../prospectus/prospectus-marc-snapshot";
import {
  buildProspectusPageOne,
  mapProspectusPageOneDataToInput,
} from "../prospectus/prospectus-page-one-mapper";
import { loadProspectusPageOneNote } from "../prospectus/prospectus-page-one-prisma";
import type { ProspectusPageOne } from "../prospectus/prospectus-page-one.types";
import type { ProspectusPublicationContent } from "../prospectus/prospectus-placeholder-publication-content";
import {
  buildProspectusPageThree,
  mapProspectusPageThreeApprovedInput,
} from "../prospectus/prospectus-page-three-mapper";
import { buildProspectusPageThreeHtml } from "../prospectus/prospectus-page-three.html";
import type { ProspectusPageThree } from "../prospectus/prospectus-page-three.types";
import {
  buildProspectusPageTwo,
  mapProspectusPageTwoApprovedInput,
} from "../prospectus/prospectus-page-two-mapper";
import { loadProspectusPageTwoNote } from "../prospectus/prospectus-page-two-prisma";
import { buildProspectusPageTwoHtml } from "../prospectus/prospectus-page-two.html";
import type { ProspectusPageTwo } from "../prospectus/prospectus-page-two.types";
import {
  PROSPECTUS_PAGE2_FINANCIAL_FREEZE_VERSION,
  type ProspectusPage2FinancialComparisonSnapshot,
} from "../prospectus/prospectus-snapshot.types";
import type { ProspectusApprovedSnapshot } from "./prospectus-approved-snapshot";

export type ProspectusFinancialPages = { page2: ProspectusPageTwo; page3: ProspectusPageThree };

/** Parsed page_2.financial_comparison of an approved snapshot (legacy or version 2). */
export function parseApprovedFinancialFreeze(
  snapshot: Pick<ProspectusApprovedSnapshot, "page_2"> | null
): ProspectusPage2FinancialComparisonSnapshot | null {
  const page2 = snapshot?.page_2;
  if (!page2 || typeof page2 !== "object" || Array.isArray(page2)) return null;
  return parseProspectusPageTwoFinancialComparison(
    (page2 as Record<string, unknown>).financial_comparison
  );
}

/** The freeze only when it is complete (version 2); legacy freezes keep their old paths. */
export function completeApprovedFinancialFreeze(
  snapshot: Pick<ProspectusApprovedSnapshot, "page_2"> | null
): ProspectusPage2FinancialComparisonSnapshot | null {
  const freeze = parseApprovedFinancialFreeze(snapshot);
  return freeze?.freeze_version === PROSPECTUS_PAGE2_FINANCIAL_FREEZE_VERSION ? freeze : null;
}

/**
 * Page 2 + Page 3 view-models from a frozen financial comparison.
 * Reads the Note (non-financial snapshots) and its MARC snapshot only.
 */
export async function buildApprovedFinancialPages(input: {
  noteId: string;
  frozenFinancialComparison: ProspectusPage2FinancialComparisonSnapshot;
  publicationContent: ProspectusPublicationContent;
}): Promise<ProspectusFinancialPages> {
  // Page 2 select is a superset of Page 3's, so one Note read serves both pages.
  const note = await loadProspectusPageTwoNote(prisma, input.noteId);
  const marcSnapshot = await resolveMarcSnapshotForProspectus(note);
  const shared = {
    note,
    marcSnapshot,
    frozenFinancialComparison: input.frozenFinancialComparison,
    publicationContent: input.publicationContent,
  };
  return {
    page2: buildProspectusPageTwo(mapProspectusPageTwoApprovedInput(shared)),
    page3: buildProspectusPageThree(mapProspectusPageThreeApprovedInput(shared)),
  };
}

export function renderApprovedFinancialPagesHtml(pages: ProspectusFinancialPages): {
  page2: string;
  page3: string;
} {
  return {
    page2: buildProspectusPageTwoHtml(pages.page2),
    page3: buildProspectusPageThreeHtml(pages.page3),
  };
}

/**
 * Page 1 with the approved (frozen) track record. `listingDates` replaces the Note's listing
 * when publish writes the real dates; `publicationContent` is set when the caller renders HTML.
 */
export async function buildApprovedPageOne(input: {
  noteId: string;
  page1Snapshot: unknown;
  publicationContent?: ProspectusPublicationContent;
  listingDates?: { opensAt: Date; closesAt: Date };
}): Promise<ProspectusPageOne> {
  const note = await loadProspectusPageOneNote(prisma, input.noteId);
  if (input.listingDates) {
    note.listing = {
      opens_at: input.listingDates.opensAt,
      closes_at: input.listingDates.closesAt,
    };
  }
  const page1Input = await mapProspectusPageOneDataToInput(note);
  if (input.publicationContent) page1Input.publicationContent = input.publicationContent;
  page1Input.trackRecordMode = "frozen_publication_snapshot";
  page1Input.page1TrackRecordSnapshot =
    input.page1Snapshot as typeof page1Input.page1TrackRecordSnapshot;
  return buildProspectusPageOne(page1Input);
}

/**
 * Publish-time Page 2 / Page 3 HTML: the approved HTML unchanged. A page whose approved HTML is
 * empty is rendered from the frozen page_2 — never from live data.
 */
export async function approvedFinancialHtmlForPublish(input: {
  noteId: string;
  approvedSnapshot: ProspectusApprovedSnapshot;
  publicationContent: ProspectusPublicationContent;
}): Promise<{ page2: string; page3: string }> {
  const approvedHtml = input.approvedSnapshot.html;
  if (approvedHtml.page2 && approvedHtml.page3) {
    return { page2: approvedHtml.page2, page3: approvedHtml.page3 };
  }
  const frozenFinancialComparison = parseApprovedFinancialFreeze(input.approvedSnapshot);
  if (!frozenFinancialComparison) {
    throw new AppError(
      409,
      "PROSPECTUS_APPROVED_SNAPSHOT_INVALID",
      "The approved Prospectus has no valid financial freeze. Approve the Prospectus again."
    );
  }
  const rendered = renderApprovedFinancialPagesHtml(
    await buildApprovedFinancialPages({
      noteId: input.noteId,
      frozenFinancialComparison,
      publicationContent: input.publicationContent,
    })
  );
  return {
    page2: approvedHtml.page2 || rendered.page2,
    page3: approvedHtml.page3 || rendered.page3,
  };
}
