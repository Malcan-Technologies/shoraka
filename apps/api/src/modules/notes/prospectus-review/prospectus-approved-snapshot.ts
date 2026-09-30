/**
 * SECTION: Build complete approved Prospectus freeze at Approve
 * WHY: Publish copies this snapshot unchanged — no section rebuild at publish
 */

import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { loadApplicationOwnedCtosFinancialReport } from "../../applications/application-owned-ctos";
import { getCurrentMarcAssessment } from "../../paymaster/service";
import { buildProspectusPage1TrackRecordSnapshot } from "../prospectus/prospectus-track-record-query";
import {
  buildProspectusPage2Snapshot,
  wrapProspectusSnapshotWithPageTwo,
} from "../prospectus/prospectus-page-two-snapshot";
import {
  cloneReviewContent,
  toProspectusPublicationContent,
  type ProspectusFrozenPublicationContent,
  type ProspectusReviewStoredContent,
} from "./prospectus-review-content";
// TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
import {
  logFingerprintComponents,
  prospectusDiag,
  rememberFingerprintSourceMeta,
} from "./prospectus-diagnostics";

export type ProspectusApprovedSnapshot = {
  publication_id: string;
  content_version: number;
  render_fingerprint: string;
  calculated_at: string;
  page_1: unknown;
  page_2: unknown;
  publication_content: ProspectusFrozenPublicationContent;
  note_identity: Record<string, unknown>;
  /** Pre-rendered investor/admin HTML — no live rebuild after approve. */
  html: {
    page1: string;
    page2: string;
    page3: string;
    page4?: string;
    page5?: string;
  };
};

function decimalToJson(value: Prisma.Decimal | number | null | undefined): string | number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  return value.toString();
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

export function hashProspectusFingerprint(parts: unknown): string {
  return createHash("sha256").update(stableStringify(parts)).digest("hex");
}

/** Canonical hash of officer draft content for change detection. */
export function hashDraftContent(content: ProspectusReviewStoredContent): string {
  return hashProspectusFingerprint(content);
}

/**
 * Load Note identity fields that affect prospectus rendering.
 * Frozen into approved_snapshot so published render needs no live Note queries.
 */
export async function loadProspectusNoteIdentityFreeze(noteId: string): Promise<{
  noteIdentity: Record<string, unknown>;
  fingerprintSource: Record<string, unknown>;
  issuerOrganizationId: string;
  financialStatements: unknown;
  ctosFinancials: unknown;
}> {
  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: {
      id: true,
      note_reference: true,
      title: true,
      issuer_organization_id: true,
      product_snapshot: true,
      purpose_snapshot: true,
      issuer_snapshot: true,
      paymaster_snapshot: true,
      invoice_snapshot: true,
      contract_snapshot: true,
      target_amount: true,
      funded_amount: true,
      profit_rate_percent: true,
      service_fee_rate_percent: true,
      platform_fee_rate_percent: true,
      maturity_date: true,
      source_application_id: true,
      listing: { select: { opens_at: true, closes_at: true } },
    },
  });
  if (!note) {
    throw new Error(`Note ${noteId} not found for prospectus freeze`);
  }

  const [application, marcSnapshot] = await Promise.all([
    note.source_application_id
      ? prisma.application.findUnique({
          where: { id: note.source_application_id },
          select: { financial_statements: true, submitted_at: true },
        })
      : Promise.resolve(null),
    getCurrentMarcAssessment(note.issuer_organization_id),
  ]);
  const ctosReport = await loadApplicationOwnedCtosFinancialReport({
    issuerOrganizationId: note.issuer_organization_id,
    submittedAt: application?.submitted_at ?? null,
  });

  const noteIdentity: Record<string, unknown> = {
    note_id: note.id,
    note_reference: note.note_reference,
    title: note.title,
    issuer_organization_id: note.issuer_organization_id,
    product_snapshot: note.product_snapshot,
    purpose_snapshot: note.purpose_snapshot,
    issuer_snapshot: note.issuer_snapshot,
    paymaster_snapshot: note.paymaster_snapshot,
    invoice_snapshot: note.invoice_snapshot,
    contract_snapshot: note.contract_snapshot,
    target_amount: decimalToJson(note.target_amount),
    funded_amount: decimalToJson(note.funded_amount),
    profit_rate_percent: decimalToJson(note.profit_rate_percent),
    service_fee_rate_percent: decimalToJson(note.service_fee_rate_percent),
    platform_fee_rate_percent: decimalToJson(note.platform_fee_rate_percent),
    maturity_date: note.maturity_date?.toISOString() ?? null,
    listing_opens_at: note.listing?.opens_at?.toISOString() ?? null,
    listing_closes_at: note.listing?.closes_at?.toISOString() ?? null,
    marc_snapshot: marcSnapshot,
  };

  // Listing opens/closes are intentionally written during Note publish.
  // Exclude them from drift/fingerprint protection so publish-time finalization
  // (injecting listing dates into Page 1) does not fail fingerprint checks.
  const fingerprintNoteIdentity = {
    ...noteIdentity,
    listing_opens_at: null,
    listing_closes_at: null,
  };

  const fingerprintSource = {
    note_identity: fingerprintNoteIdentity,
    financial_statements: application?.financial_statements ?? null,
    ctos_financials: ctosReport?.financialsJson ?? null,
  };

  // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
  const diagSourceMeta = {
    application: note.source_application_id
      ? {
          id: note.source_application_id,
          found: application != null,
          submittedAt: application?.submitted_at?.toISOString?.() ?? null,
        }
      : null,
    ctosReport: ctosReport
      ? { id: ctosReport.id, fetchedAt: ctosReport.fetchedAt?.toISOString?.() ?? null }
      : null,
    hasMarcSnapshot: marcSnapshot != null,
    listingOpensAt: noteIdentity.listing_opens_at,
    listingClosesAt: noteIdentity.listing_closes_at,
  };
  rememberFingerprintSourceMeta(fingerprintSource, diagSourceMeta);
  prospectusDiag("prospectus.fingerprint.sources_loaded", () => ({
    noteId,
    noteReference: note.note_reference,
    issuerOrganizationId: note.issuer_organization_id,
    ...diagSourceMeta,
    hasFinancialStatements: application?.financial_statements != null,
    hasCtosFinancials: ctosReport?.financialsJson != null,
  }));

  return {
    noteIdentity,
    fingerprintSource,
    issuerOrganizationId: note.issuer_organization_id,
    financialStatements: application?.financial_statements ?? null,
    ctosFinancials: ctosReport?.financialsJson ?? null,
  };
}

/**
 * Build the complete approved freeze. Called only at Approve — never at Publish.
 */
export async function buildCompleteApprovedProspectusSnapshot(input: {
  noteId: string;
  publicationId: string;
  contentVersion: number;
  approvedContent: ProspectusReviewStoredContent;
  approvedAt: Date;
  approvedByUserId: string;
  optionCatalogueVersion: string;
}): Promise<ProspectusApprovedSnapshot> {
  const now = input.approvedAt;
  const { noteIdentity, fingerprintSource, issuerOrganizationId, financialStatements, ctosFinancials } =
    await loadProspectusNoteIdentityFreeze(input.noteId);

  const page1 = await buildProspectusPage1TrackRecordSnapshot({
    issuerOrganizationId,
    currentNoteId: input.noteId,
    now,
  });
  const page2 = buildProspectusPage2Snapshot({
    financialStatements,
    ctosFinancials,
    now,
  });

  const publicationContent: ProspectusFrozenPublicationContent = {
    version: `content.${input.contentVersion}`,
    optionCatalogueVersion: input.optionCatalogueVersion,
    approvedAt: now.toISOString(),
    approvedBy: input.approvedByUserId,
    content: cloneReviewContent(input.approvedContent),
    resolvedPublicationContent: toProspectusPublicationContent(input.approvedContent),
  };

  const wrapped = wrapProspectusSnapshotWithPageTwo(page1, page2, null) as Record<
    string,
    unknown
  >;

  const draftHash = hashDraftContent(input.approvedContent);
  // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
  // Same object as before, hoisted so the exact hashed input can be logged.
  const fingerprintParts = {
    draft: draftHash,
    sources: fingerprintSource,
    page_1: page1,
    page_2: page2,
  };
  prospectusDiag(
    "prospectus.approve.fingerprint_input",
    () => ({
      noteId: input.noteId,
      publicationId: input.publicationId,
      contentVersion: input.contentVersion,
      draftHash,
      sourcesHash: hashProspectusFingerprint(fingerprintSource),
      page1Hash: hashProspectusFingerprint(page1),
      page2Hash: hashProspectusFingerprint(page2),
    }),
    () => ({ fingerprintInput: fingerprintParts })
  );
  const renderFingerprint = hashProspectusFingerprint(fingerprintParts);
  // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
  logFingerprintComponents({
    phase: "approve",
    noteId: input.noteId,
    parts: fingerprintParts,
    fingerprint: renderFingerprint,
    hash: hashProspectusFingerprint,
  });
  prospectusDiag("prospectus.approve.fingerprint_built", () => ({
    noteId: input.noteId,
    publicationId: input.publicationId,
    contentVersion: input.contentVersion,
    renderFingerprint,
    draftHash,
  }));

  return {
    publication_id: input.publicationId,
    content_version: input.contentVersion,
    render_fingerprint: renderFingerprint,
    calculated_at: now.toISOString(),
    page_1: wrapped.page_1,
    page_2: wrapped.page_2,
    publication_content: publicationContent,
    note_identity: noteIdentity,
    html: { page1: "", page2: "", page3: "" },
  };
}

/**
 * Attach pre-rendered HTML to an approved snapshot (call once at Approve).
 * Publish and investor views use this HTML without rebuilding.
 */
export function withApprovedSnapshotHtml(
  snapshot: ProspectusApprovedSnapshot,
  html: { page1: string; page2: string; page3: string; page4?: string; page5?: string }
): ProspectusApprovedSnapshot {
  return { ...snapshot, html };
}

/** Recompute fingerprint from current live sources + stored approved officer content. */
export async function computeCurrentRenderFingerprint(input: {
  noteId: string;
  approvedContent: ProspectusReviewStoredContent;
  approvedSnapshot: ProspectusApprovedSnapshot;
}): Promise<string> {
  const { fingerprintSource } = await loadProspectusNoteIdentityFreeze(input.noteId);
  const draftHash = hashDraftContent(input.approvedContent);
  // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
  // Same object as before, hoisted so the exact hashed input can be logged.
  const fingerprintParts = {
    draft: draftHash,
    sources: fingerprintSource,
    page_1: input.approvedSnapshot.page_1,
    page_2: input.approvedSnapshot.page_2,
  };
  const currentFingerprint = hashProspectusFingerprint(fingerprintParts);
  // TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
  logFingerprintComponents({
    phase: "recompute",
    noteId: input.noteId,
    parts: fingerprintParts,
    fingerprint: currentFingerprint,
    hash: hashProspectusFingerprint,
    storedNoteIdentity: input.approvedSnapshot.note_identity,
    storedFingerprint: input.approvedSnapshot.render_fingerprint,
  });
  return currentFingerprint;
}

export function parseApprovedSnapshot(value: unknown): ProspectusApprovedSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (
    typeof v.publication_id !== "string" ||
    typeof v.render_fingerprint !== "string" ||
    typeof v.content_version !== "number" ||
    !v.page_1 ||
    !v.page_2 ||
    !v.publication_content ||
    !v.note_identity ||
    !v.html ||
    typeof (v.html as { page1?: unknown }).page1 !== "string"
  ) {
    return null;
  }
  return value as ProspectusApprovedSnapshot;
}
