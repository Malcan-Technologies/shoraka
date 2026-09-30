#!/usr/bin/env tsx
/**
 * Classify existing Notes that have no notes.financial_snapshot, and backfill only class A.
 *
 * Usage:
 *   pnpm --filter @cashsouk/api notes:classify-financial-snapshots                 # dry run
 *   pnpm --filter @cashsouk/api notes:classify-financial-snapshots -- --json
 *   pnpm --filter @cashsouk/api notes:classify-financial-snapshots -- --note <noteId>
 *   pnpm --filter @cashsouk/api notes:classify-financial-snapshots -- --apply --confirm-class-a-only
 *
 * Dry run by default: reads only. Writes require BOTH --apply and --confirm-class-a-only, and then
 * only notes.financial_snapshot on eligible class A Notes, through a guarded update that matches a
 * row whose snapshot is still null. Re-running is a no-op. Never touches Prospectus reviews,
 * publications, notes.prospectus_snapshot, applications or CTOS rows.
 * Output carries ids, references, classes and reasons only — never financial or personal data.
 */
import "dotenv/config";
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  classifyNoteFinancialSnapshotBackfill,
  NON_APPROVED_PROSPECTUS_REVIEW_STATUSES,
  parseBackfillCliArgs,
  type ApprovedFingerprintInput,
  type BackfillCliOptions,
  type NoteFinancialSnapshotBackfillClassification,
  type NoteFinancialSnapshotBackfillFacts,
  type NoteFingerprintCheck,
} from "../src/modules/notes/note-financial-snapshot-backfill";

type Db = PrismaClient | Prisma.TransactionClient;
type AppModules = {
  prisma: PrismaClient;
  buildNoteFinancialSnapshot: typeof import("../src/modules/notes/note-financial-snapshot").buildNoteFinancialSnapshot;
  computeCurrentRenderFingerprint: typeof import("../src/modules/notes/prospectus-review/prospectus-approved-snapshot").computeCurrentRenderFingerprint;
  parseApprovedSnapshot: typeof import("../src/modules/notes/prospectus-review/prospectus-approved-snapshot").parseApprovedSnapshot;
};

const BATCH_SIZE = 100;

const NOTE_SELECT = {
  id: true,
  note_reference: true,
  source_application_id: true,
  status: true,
  published_at: true,
  created_at: true,
  financial_snapshot: true,
  prospectus_review: { select: { status: true } },
} satisfies Prisma.NoteSelect;

type NoteRow = Prisma.NoteGetPayload<{ select: typeof NOTE_SELECT }>;

type WriteOutcome = "WRITTEN" | "SKIPPED_NO_LONGER_ELIGIBLE" | "SKIPPED_GUARD_NOT_MATCHED";

type ResultRow = NoteFinancialSnapshotBackfillClassification & {
  noteReference: string;
  write: WriteOutcome | null;
};

/** Loaded after flags are parsed so --json can quiet the app logger before it is created. */
async function loadAppModules(): Promise<AppModules> {
  const [{ prisma }, snapshot, approved] = await Promise.all([
    import("../src/lib/prisma"),
    import("../src/modules/notes/note-financial-snapshot"),
    import("../src/modules/notes/prospectus-review/prospectus-approved-snapshot"),
  ]);
  return {
    prisma,
    buildNoteFinancialSnapshot: snapshot.buildNoteFinancialSnapshot,
    computeCurrentRenderFingerprint: approved.computeCurrentRenderFingerprint,
    parseApprovedSnapshot: approved.parseApprovedSnapshot,
  };
}

function describeDatabaseTarget(): string {
  try {
    const url = new URL(process.env.DATABASE_URL ?? "");
    return `${url.hostname}:${url.port || "5432"}${url.pathname}`;
  } catch {
    return "(DATABASE_URL not parseable)";
  }
}

function safeErrorLabel(error: unknown): string {
  if (!(error instanceof Error)) return "non-Error thrown";
  const code = (error as { code?: unknown }).code;
  const firstLine = error.message.split("\n").find((line) => line.trim().length > 0) ?? "";
  const label = `${error.name}${typeof code === "string" ? ` ${code}` : ""}: ${firstLine.trim()}`;
  return label.length > 160 ? `${label.slice(0, 157)}...` : label;
}

/** Source application facts for a bounded list of application ids. */
async function loadSourceApplications(
  db: Db,
  applicationIds: string[]
): Promise<Map<string, NonNullable<NoteFinancialSnapshotBackfillFacts["sourceApplication"]>>> {
  const ids = [...new Set(applicationIds)];
  const [applications, financialReviews] = await Promise.all([
    db.application.findMany({
      where: { id: { in: ids } },
      select: { id: true, status: true },
      take: ids.length,
    }),
    // (application_id, section) is unique, so at most one row per id.
    db.applicationReview.findMany({
      where: { application_id: { in: ids }, section: "financial" },
      select: { application_id: true, status: true, reviewed_at: true },
      take: ids.length,
    }),
  ]);
  const reviewByApp = new Map(financialReviews.map((r) => [r.application_id, r]));
  return new Map(
    applications.map((app) => {
      const review = reviewByApp.get(app.id);
      return [
        app.id,
        {
          status: app.status,
          financialReviewStatus: review?.status ?? null,
          financialReviewedAt: review?.reviewed_at ?? null,
        },
      ];
    })
  );
}

async function checkFingerprint(app: AppModules, noteId: string): Promise<NoteFingerprintCheck> {
  const review = await app.prisma.noteProspectusReview.findUnique({
    where: { note_id: noteId },
    select: { approved_snapshot: true, approved_content: true, render_fingerprint: true },
  });
  const snapshot = app.parseApprovedSnapshot(review?.approved_snapshot);
  const missing: ApprovedFingerprintInput[] = [];
  if (!snapshot) missing.push("approved_snapshot");
  if (review?.approved_content == null) missing.push("approved_content");
  if (!review?.render_fingerprint) missing.push("render_fingerprint");
  if (!snapshot || review?.approved_content == null || !review.render_fingerprint) {
    return { kind: "MISSING_INPUTS", missing };
  }
  if (snapshot.render_fingerprint !== review.render_fingerprint) {
    return { kind: "STORED_FINGERPRINT_INCONSISTENT" };
  }
  try {
    const currentFingerprint = await app.computeCurrentRenderFingerprint({
      noteId,
      approvedContent: review.approved_content as unknown as Parameters<
        AppModules["computeCurrentRenderFingerprint"]
      >[0]["approvedContent"],
      approvedSnapshot: snapshot,
    });
    return {
      kind: "COMPUTED",
      storedFingerprint: review.render_fingerprint,
      currentFingerprint,
    };
  } catch (error) {
    return { kind: "RECOMPUTE_FAILED", error: safeErrorLabel(error) };
  }
}

function toFacts(
  note: NoteRow,
  sourceApplication: NoteFinancialSnapshotBackfillFacts["sourceApplication"],
  fingerprint: NoteFingerprintCheck | null
): NoteFinancialSnapshotBackfillFacts {
  return {
    note: {
      id: note.id,
      sourceApplicationId: note.source_application_id,
      status: note.status,
      publishedAt: note.published_at,
      createdAt: note.created_at,
      financialSnapshot: note.financial_snapshot,
    },
    review: note.prospectus_review ? { status: note.prospectus_review.status } : null,
    fingerprint,
    sourceApplication,
  };
}

async function classifyBatch(
  app: AppModules,
  notes: NoteRow[]
): Promise<{ note: NoteRow; result: NoteFinancialSnapshotBackfillClassification }[]> {
  const sources = await loadSourceApplications(
    app.prisma,
    notes.map((n) => n.source_application_id)
  );
  const out: { note: NoteRow; result: NoteFinancialSnapshotBackfillClassification }[] = [];
  for (const note of notes) {
    const draftFacts = toFacts(note, sources.get(note.source_application_id) ?? null, null);
    const preliminary = classifyNoteFinancialSnapshotBackfill(draftFacts);
    if (
      preliminary.classification === "HAS_SNAPSHOT" ||
      preliminary.classification === "A_NO_APPROVED_PROSPECTUS"
    ) {
      out.push({ note, result: preliminary });
      continue;
    }
    const fingerprint = await checkFingerprint(app, note.id);
    out.push({ note, result: classifyNoteFinancialSnapshotBackfill({ ...draftFacts, fingerprint }) });
  }
  return out;
}

/**
 * Re-classify inside a transaction and write through a guarded update. The update matches only
 * while the snapshot is still null, the Note is unpublished and its review never approved.
 */
async function writeEligibleSnapshot(app: AppModules, noteId: string): Promise<WriteOutcome> {
  return app.prisma.$transaction(async (tx) => {
    const note = await tx.note.findUnique({ where: { id: noteId }, select: NOTE_SELECT });
    if (!note) return "SKIPPED_NO_LONGER_ELIGIBLE";
    const sources = await loadSourceApplications(tx, [note.source_application_id]);
    const recheck = classifyNoteFinancialSnapshotBackfill(
      toFacts(note, sources.get(note.source_application_id) ?? null, null)
    );
    if (!recheck.eligibleForBackfill) return "SKIPPED_NO_LONGER_ELIGIBLE";

    const snapshot = await app.buildNoteFinancialSnapshot({
      db: tx,
      applicationId: note.source_application_id,
      capturedAt: note.created_at,
    });
    if (snapshot.source.financial_review.status !== "APPROVED") return "SKIPPED_NO_LONGER_ELIGIBLE";

    const updated = await tx.note.updateMany({
      where: {
        id: note.id,
        source_application_id: note.source_application_id,
        financial_snapshot: { equals: Prisma.AnyNull },
        OR: [{ published_at: null }, { status: "DRAFT" }],
        AND: [
          {
            OR: [
              { prospectus_review: { is: null } },
              {
                prospectus_review: {
                  is: { status: { in: [...NON_APPROVED_PROSPECTUS_REVIEW_STATUSES] } },
                },
              },
            ],
          },
        ],
      },
      data: { financial_snapshot: snapshot as unknown as Prisma.InputJsonValue },
    });
    return updated.count === 1 ? "WRITTEN" : "SKIPPED_GUARD_NOT_MATCHED";
  });
}

async function* noteBatches(app: AppModules, noteId: string | null): AsyncGenerator<NoteRow[]> {
  if (noteId) {
    const note = await app.prisma.note.findUnique({ where: { id: noteId }, select: NOTE_SELECT });
    if (!note) throw new Error(`Note ${noteId} not found`);
    yield [note];
    return;
  }
  let cursor: string | null = null;
  for (;;) {
    const batch: NoteRow[] = await app.prisma.note.findMany({
      select: NOTE_SELECT,
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (batch.length === 0) return;
    yield batch;
    if (batch.length < BATCH_SIZE) return;
    cursor = batch[batch.length - 1].id;
  }
}

function formatLine(row: ResultRow): string {
  const write = row.write ? ` write=${row.write}` : "";
  return [
    row.noteId,
    row.noteReference,
    row.classification,
    row.sourceDrift ?? "-",
    `eligible=${row.eligibleForBackfill ? "yes" : "no"}${write}`,
    row.reason,
  ].join(" | ");
}

function summarize(rows: ResultRow[]) {
  const count = (pred: (r: ResultRow) => boolean) => rows.filter(pred).length;
  const classes = [
    "HAS_SNAPSHOT",
    "A_NO_APPROVED_PROSPECTUS",
    "B_APPROVED_PROSPECTUS",
    "C_PUBLISHED_PROSPECTUS",
  ] as const;
  const byClass = Object.fromEntries(
    classes.map((c) => [
      c,
      {
        total: count((r) => r.classification === c),
        D_SOURCES_UNCHANGED: count((r) => r.classification === c && r.sourceDrift === "D_SOURCES_UNCHANGED"),
        E_SOURCES_MAY_HAVE_CHANGED: count(
          (r) => r.classification === c && r.sourceDrift === "E_SOURCES_MAY_HAVE_CHANGED"
        ),
        eligible: count((r) => r.classification === c && r.eligibleForBackfill),
      },
    ])
  );
  const blockers: Record<string, number> = {};
  for (const row of rows) for (const b of row.blockers) blockers[b] = (blockers[b] ?? 0) + 1;
  const writes = {
    WRITTEN: count((r) => r.write === "WRITTEN"),
    SKIPPED_NO_LONGER_ELIGIBLE: count((r) => r.write === "SKIPPED_NO_LONGER_ELIGIBLE"),
    SKIPPED_GUARD_NOT_MATCHED: count((r) => r.write === "SKIPPED_GUARD_NOT_MATCHED"),
  };
  return { total: rows.length, byClass, blockers, writes };
}

const LEGACY_NOTE =
  "B and C Notes are left on the legacy path (live application + owned CTOS) and are never backfilled: copying today's data could attach a financial state the officer never approved.";
const E_NOTE =
  "E: the approved financial inputs cannot be reconstructed from stored data — the approved snapshot keeps derived page data and a hash of the sources, not the sources — so these are reported, not guessed. A mismatch may also be the known number-storage defect of approvals made before the fix.";

function printHuman(options: BackfillCliOptions, rows: ResultRow[]) {
  const s = summarize(rows);
  console.log("\nSummary");
  console.log("class                      total    D    E  eligible");
  for (const [cls, c] of Object.entries(s.byClass)) {
    console.log(
      `${cls.padEnd(26)} ${String(c.total).padStart(5)} ${String(c.D_SOURCES_UNCHANGED).padStart(4)} ${String(c.E_SOURCES_MAY_HAVE_CHANGED).padStart(4)} ${String(c.eligible).padStart(9)}`
    );
  }
  console.log(`${"TOTAL".padEnd(26)} ${String(s.total).padStart(5)}`);
  const blockerEntries = Object.entries(s.blockers);
  console.log(
    `Blockers: ${blockerEntries.length ? blockerEntries.map(([k, v]) => `${k}=${v}`).join(", ") : "none"}`
  );
  if (options.mode === "apply") {
    console.log(
      `Writes: WRITTEN=${s.writes.WRITTEN}, SKIPPED_NO_LONGER_ELIGIBLE=${s.writes.SKIPPED_NO_LONGER_ELIGIBLE}, SKIPPED_GUARD_NOT_MATCHED=${s.writes.SKIPPED_GUARD_NOT_MATCHED}`
    );
  } else {
    console.log("Dry run: nothing written. Pass --apply --confirm-class-a-only to backfill eligible class A Notes.");
  }
  console.log(`\n${LEGACY_NOTE}\n${E_NOTE}`);
}

async function run(app: AppModules, options: BackfillCliOptions): Promise<ResultRow[]> {
  const rows: ResultRow[] = [];
  if (!options.json) {
    console.log(`Database: ${describeDatabaseTarget()}  mode=${options.mode}`);
    console.log("noteId | reference | class | D/E | eligible | reason");
  }
  for await (const batch of noteBatches(app, options.noteId)) {
    for (const { note, result } of await classifyBatch(app, batch)) {
      const write =
        options.mode === "apply" && result.eligibleForBackfill
          ? await writeEligibleSnapshot(app, note.id)
          : null;
      const row: ResultRow = { ...result, noteReference: note.note_reference, write };
      rows.push(row);
      if (!options.json) console.log(formatLine(row));
    }
  }
  return rows;
}

async function main() {
  const parsed = parseBackfillCliArgs(process.argv.slice(2));
  if (!parsed.ok) {
    console.error(parsed.error);
    process.exitCode = 1;
    return;
  }
  const { options } = parsed;
  if (options.json) process.env.LOG_LEVEL = "warn";
  const app = await loadAppModules();
  try {
    const rows = await run(app, options);
    if (options.json) {
      console.log(
        JSON.stringify(
          {
            database: describeDatabaseTarget(),
            mode: options.mode,
            summary: summarize(rows),
            notes: { legacyPath: LEGACY_NOTE, sourcesMayHaveChanged: E_NOTE },
            rows,
          },
          null,
          2
        )
      );
    } else {
      printHuman(options, rows);
    }
  } finally {
    await app.prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(safeErrorLabel(error));
  process.exitCode = 1;
});
