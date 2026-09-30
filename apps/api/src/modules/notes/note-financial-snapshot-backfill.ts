/**
 * SECTION: Classify existing Notes for notes.financial_snapshot backfill
 * WHY: Only Notes whose Prospectus was never approved may receive a snapshot copied from the
 * final reviewed application. Approved or published Prospectuses stay on the legacy live path,
 * because today's application/CTOS data may differ from what the officer approved.
 * Pure module: callers load the facts; nothing here reads or writes the database.
 */

import { isNoteProspectusPublished } from "@cashsouk/types";
import { parseNoteFinancialSnapshot } from "./note-financial-snapshot.types";

export type NoteFinancialSnapshotBackfillClass =
  | "HAS_SNAPSHOT"
  | "A_NO_APPROVED_PROSPECTUS"
  | "B_APPROVED_PROSPECTUS"
  | "C_PUBLISHED_PROSPECTUS";

export type NoteFinancialSourceDrift = "D_SOURCES_UNCHANGED" | "E_SOURCES_MAY_HAVE_CHANGED";

export type NoteFinancialSnapshotBackfillBlocker =
  | "MALFORMED_SNAPSHOT_PRESENT"
  | "SOURCE_APPLICATION_MISSING"
  | "SOURCE_APPLICATION_NOT_COMPLETED"
  | "FINANCIAL_REVIEW_NOT_APPROVED"
  | "FINANCIAL_REVIEWED_AFTER_NOTE_CREATED";

/** Review statuses that never produced an approved Prospectus freeze. */
export const NON_APPROVED_PROSPECTUS_REVIEW_STATUSES = [
  "DRAFT",
  "READY_FOR_REVIEW",
  "SUPERSEDED",
] as const;

const APPROVED_PROSPECTUS_REVIEW_STATUSES = ["APPROVED", "READY_FOR_PUBLISH"] as const;

export type ApprovedFingerprintInput = "approved_snapshot" | "approved_content" | "render_fingerprint";

/** Outcome of recomputing the Prospectus render fingerprint (loaded by the caller). */
export type NoteFingerprintCheck =
  | { kind: "MISSING_INPUTS"; missing: ApprovedFingerprintInput[] }
  | { kind: "STORED_FINGERPRINT_INCONSISTENT" }
  | { kind: "RECOMPUTE_FAILED"; error: string }
  | { kind: "COMPUTED"; storedFingerprint: string; currentFingerprint: string };

export type NoteFinancialSnapshotBackfillFacts = {
  note: {
    id: string;
    sourceApplicationId: string;
    status: string;
    publishedAt: Date | null;
    createdAt: Date;
    financialSnapshot: unknown;
  };
  review: { status: string } | null;
  /** Required for Notes in class B or C; ignored otherwise. */
  fingerprint: NoteFingerprintCheck | null;
  sourceApplication: {
    status: string;
    financialReviewStatus: string | null;
    financialReviewedAt: Date | null;
  } | null;
};

export type NoteFinancialSnapshotBackfillClassification = {
  noteId: string;
  classification: NoteFinancialSnapshotBackfillClass;
  sourceDrift: NoteFinancialSourceDrift | null;
  eligibleForBackfill: boolean;
  blockers: NoteFinancialSnapshotBackfillBlocker[];
  reason: string;
};

const MISMATCH_CAVEAT =
  "A mismatch can also be the known number-storage defect of approvals made before the fix, not only a real source change.";

export type ProspectusStage = Exclude<NoteFinancialSnapshotBackfillClass, "HAS_SNAPSHOT">;

/** Prospectus stage for a Note without a valid snapshot. Unknown review statuses count as approved (never eligible). */
export function resolveProspectusStage(
  note: Pick<NoteFinancialSnapshotBackfillFacts["note"], "status" | "publishedAt">,
  review: NoteFinancialSnapshotBackfillFacts["review"]
): ProspectusStage {
  const published = isNoteProspectusPublished({ status: note.status, publishedAt: note.publishedAt });
  if (published || review?.status === "PUBLISHED") return "C_PUBLISHED_PROSPECTUS";
  if (!review) return "A_NO_APPROVED_PROSPECTUS";
  if ((NON_APPROVED_PROSPECTUS_REVIEW_STATUSES as readonly string[]).includes(review.status)) {
    return "A_NO_APPROVED_PROSPECTUS";
  }
  return "B_APPROVED_PROSPECTUS";
}

function stageReason(stage: ProspectusStage, facts: NoteFinancialSnapshotBackfillFacts): string {
  const reviewLabel = facts.review ? `review ${facts.review.status}` : "no Prospectus review";
  if (stage === "A_NO_APPROVED_PROSPECTUS") {
    return `Prospectus never approved (${reviewLabel}); Note not published.`;
  }
  if (stage === "B_APPROVED_PROSPECTUS") {
    const known = (APPROVED_PROSPECTUS_REVIEW_STATUSES as readonly string[]).includes(
      facts.review?.status ?? ""
    );
    const label = known ? reviewLabel : `${reviewLabel}, unrecognised status treated as approved`;
    return `Prospectus approved (${label}); Note not published. Left on the legacy path so the approved Prospectus keeps its sources.`;
  }
  return `Note published (${reviewLabel}). Left on the legacy path so the investor-facing Prospectus keeps its sources.`;
}

function driftFor(check: NoteFingerprintCheck | null): {
  drift: NoteFinancialSourceDrift;
  reason: string;
} {
  if (!check) {
    return { drift: "E_SOURCES_MAY_HAVE_CHANGED", reason: "Fingerprint was not checked." };
  }
  switch (check.kind) {
    case "COMPUTED":
      return check.currentFingerprint === check.storedFingerprint
        ? {
            drift: "D_SOURCES_UNCHANGED",
            reason: "Recomputed render fingerprint equals the stored one.",
          }
        : {
            drift: "E_SOURCES_MAY_HAVE_CHANGED",
            reason: `Recomputed render fingerprint differs from the stored one (it also covers Note identity and MARC inputs, so the change is not necessarily financial). ${MISMATCH_CAVEAT}`,
          };
    case "MISSING_INPUTS":
      return {
        drift: "E_SOURCES_MAY_HAVE_CHANGED",
        reason: `Fingerprint cannot be recomputed: missing ${check.missing.join(", ")}.`,
      };
    case "STORED_FINGERPRINT_INCONSISTENT":
      return {
        drift: "E_SOURCES_MAY_HAVE_CHANGED",
        reason:
          "Fingerprint cannot be trusted: review render_fingerprint differs from approved_snapshot.render_fingerprint.",
      };
    case "RECOMPUTE_FAILED":
      return {
        drift: "E_SOURCES_MAY_HAVE_CHANGED",
        reason: `Fingerprint recompute failed (${check.error}).`,
      };
  }
}

function sourceBlockers(
  facts: NoteFinancialSnapshotBackfillFacts
): { blocker: NoteFinancialSnapshotBackfillBlocker; reason: string }[] {
  const app = facts.sourceApplication;
  if (!app) {
    return [{ blocker: "SOURCE_APPLICATION_MISSING", reason: "Source application not found." }];
  }
  const out: { blocker: NoteFinancialSnapshotBackfillBlocker; reason: string }[] = [];
  if (app.status !== "COMPLETED") {
    out.push({
      blocker: "SOURCE_APPLICATION_NOT_COMPLETED",
      reason: `Source application is ${app.status}, not COMPLETED; reviewed state is not final.`,
    });
  }
  if (app.financialReviewStatus !== "APPROVED") {
    out.push({
      blocker: "FINANCIAL_REVIEW_NOT_APPROVED",
      reason: `Financial review section is ${app.financialReviewStatus ?? "missing"}, not APPROVED; reviewed state is not final.`,
    });
  } else if (
    app.financialReviewedAt &&
    app.financialReviewedAt.getTime() > facts.note.createdAt.getTime()
  ) {
    out.push({
      blocker: "FINANCIAL_REVIEWED_AFTER_NOTE_CREATED",
      reason:
        "Financial review was approved after the Note was created; today's reviewed state may differ from the one at Note creation.",
    });
  }
  return out;
}

export function classifyNoteFinancialSnapshotBackfill(
  facts: NoteFinancialSnapshotBackfillFacts
): NoteFinancialSnapshotBackfillClassification {
  const noteId = facts.note.id;
  const rawSnapshot = facts.note.financialSnapshot;
  const parsed = parseNoteFinancialSnapshot(rawSnapshot);

  if (parsed) {
    const mismatch =
      parsed.source.application_id !== facts.note.sourceApplicationId
        ? " Snapshot source application differs from the Note's source application; review manually."
        : "";
    return {
      noteId,
      classification: "HAS_SNAPSHOT",
      sourceDrift: null,
      eligibleForBackfill: false,
      blockers: [],
      reason: `Valid financial snapshot already present; nothing to do.${mismatch}`,
    };
  }

  const reasons: string[] = [];
  const blockers: NoteFinancialSnapshotBackfillBlocker[] = [];
  if (rawSnapshot != null) {
    blockers.push("MALFORMED_SNAPSHOT_PRESENT");
    reasons.push(
      "financial_snapshot is present but malformed; treated as no snapshot and never overwritten."
    );
  }

  const stage = resolveProspectusStage(facts.note, facts.review);
  reasons.push(stageReason(stage, facts));

  let sourceDrift: NoteFinancialSourceDrift | null = null;
  if (stage !== "A_NO_APPROVED_PROSPECTUS") {
    const drift = driftFor(facts.fingerprint);
    sourceDrift = drift.drift;
    reasons.push(drift.reason);
    if (drift.drift === "E_SOURCES_MAY_HAVE_CHANGED") {
      reasons.push(
        "Approved financial inputs cannot be reconstructed from stored data (the approved snapshot keeps derived page data and a hash of the sources); reported, not guessed."
      );
    }
  }

  for (const item of sourceBlockers(facts)) {
    blockers.push(item.blocker);
    reasons.push(item.reason);
  }

  const eligibleForBackfill = stage === "A_NO_APPROVED_PROSPECTUS" && blockers.length === 0;
  if (eligibleForBackfill) {
    reasons.push("Eligible: snapshot can be copied from the final reviewed application.");
  }

  return {
    noteId,
    classification: stage,
    sourceDrift,
    eligibleForBackfill,
    blockers,
    reason: reasons.join(" "),
  };
}

export type BackfillCliOptions = {
  mode: "dry-run" | "apply";
  json: boolean;
  noteId: string | null;
};

const KNOWN_FLAGS = new Set(["--apply", "--confirm-class-a-only", "--json", "--note"]);

/**
 * Parse CLI flags. Writes require BOTH --apply and --confirm-class-a-only; either alone is an
 * error, as is any unknown flag, so a typo never silently changes behaviour.
 */
export function parseBackfillCliArgs(
  argv: string[]
): { ok: true; options: BackfillCliOptions } | { ok: false; error: string } {
  let noteId: string | null = null;
  const flags = new Set<string>();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--") continue;
    if (!KNOWN_FLAGS.has(arg)) return { ok: false, error: `Unknown argument: ${arg}` };
    if (flags.has(arg)) return { ok: false, error: `Duplicate argument: ${arg}` };
    flags.add(arg);
    if (arg === "--note") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) return { ok: false, error: "--note requires a Note id" };
      noteId = value;
      i += 1;
    }
  }
  const apply = flags.has("--apply");
  const confirm = flags.has("--confirm-class-a-only");
  if (apply !== confirm) {
    return {
      ok: false,
      error: "Writing requires both --apply and --confirm-class-a-only; pass both or neither.",
    };
  }
  return {
    ok: true,
    options: { mode: apply ? "apply" : "dry-run", json: flags.has("--json"), noteId },
  };
}
