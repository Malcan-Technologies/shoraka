// TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
/**
 * SECTION: Temporary Prospectus review/approval diagnostics
 * WHY: Reconstruct Draft → Approve → "still Draft" in production logs. Logging only.
 *
 * Rules kept by every helper here:
 * - never throws into business code (payloads are built inside try/catch)
 * - never reads or writes the database
 * - PROSPECTUS_DIAG_LOGS: unset = full, "hashes" = no raw payloads, "off" = silent.
 *   Jest (NODE_ENV=test) defaults to "off" unless the variable is set.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import { logger } from "../../../lib/logger";

export type ProspectusDiagContext = {
  correlationId?: string;
  requestId?: unknown;
  actorUserId?: string;
  method?: string;
  route?: string;
  noteId?: string;
  operation?: string;
};

type ProspectusDiagStore = {
  ctx: ProspectusDiagContext;
  reqSeq: number;
  stash: Record<string, unknown>;
};

type DiagHash = (value: unknown) => string;
type DiagMode = "full" | "hashes" | "off";

const DIAG_MARKER = "TEMP_PROSPECTUS_DIAGNOSTIC";
/** CloudWatch caps one event at 256 KB; escaped JSON-in-JSON can double in size. */
const PAYLOAD_CHUNK_CHARS = 60_000;
const FINGERPRINT_SUMMARY_LIMIT = 50;

const storage = new AsyncLocalStorage<ProspectusDiagStore>();
let processSeq = 0;

function diagMode(): DiagMode {
  const raw = process.env.PROSPECTUS_DIAG_LOGS?.trim().toLowerCase();
  if (raw === "off" || raw === "hashes" || raw === "full") return raw;
  return process.env.NODE_ENV === "test" ? "off" : "full";
}

function reportDiagFailure(event: string, error: unknown) {
  try {
    logger.error(
      {
        diag: DIAG_MARKER,
        event: "prospectus.diag.failure",
        failedEvent: event,
        ts: Date.now(),
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "prospectus.diag.failure"
    );
  } catch {
    // Diagnostics must never surface an error.
  }
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** JSON that keeps what plain JSON hides: undefined values, Dates, class instances. */
function diagSerialize(value: unknown): string {
  const markers = new WeakSet<object>();
  const mark = <T extends object>(marker: T): T => {
    markers.add(marker);
    return marker;
  };
  const text = JSON.stringify(value, function (this: Record<string, unknown>, key, val) {
    // Contents of a marker object were already converted; pass them through.
    if (markers.has(this)) return val;
    const original = this[key];
    if (Object.prototype.toString.call(original) === "[object Date]") {
      const date = original as Date;
      return mark({ __date: Number.isNaN(date.getTime()) ? "Invalid Date" : date.toISOString() });
    }
    if (val === undefined) return "__undefined__";
    if (typeof val === "bigint") return mark({ __bigint: val.toString() });
    if (typeof val === "function") return "__function__";
    if (original && typeof original === "object" && !Array.isArray(original)) {
      const className = Object.getPrototypeOf(original)?.constructor?.name;
      // Class instances (e.g. Prisma Decimal) hash differently from their JSON form.
      if (className && className !== "Object") return mark({ __class: className, value: val });
    }
    return val;
  });
  return text ?? "null";
}

/** The production hash throws on a top-level `undefined`; diagnostics must not. */
export function diagSafeHash(hash: DiagHash, value: unknown): string {
  if (value === undefined) return "__undefined__";
  try {
    return hash(value);
  } catch (error) {
    return `__hash_error__:${error instanceof Error ? error.message : String(error)}`;
  }
}

function baseFields(event: string) {
  const store = storage.getStore();
  if (store) store.reqSeq += 1;
  processSeq += 1;
  return {
    diag: DIAG_MARKER,
    event,
    ts: Date.now(),
    seq: processSeq,
    reqSeq: store?.reqSeq ?? null,
    ...(store?.ctx ?? {}),
  };
}

function emitRawPayloads(parentEvent: string, parentSeq: number, raw: Record<string, unknown>) {
  for (const [field, value] of Object.entries(raw)) {
    try {
      const serialized = diagSerialize(value);
      const checksum = sha256(serialized);
      const chunks = Math.max(1, Math.ceil(serialized.length / PAYLOAD_CHUNK_CHARS));
      for (let index = 0; index < chunks; index += 1) {
        const slice = serialized.slice(
          index * PAYLOAD_CHUNK_CHARS,
          (index + 1) * PAYLOAD_CHUNK_CHARS
        );
        logger.info(
          {
            ...baseFields("prospectus.diag.payload"),
            parentEvent,
            parentSeq,
            field,
            chars: serialized.length,
            sha256: checksum,
            chunk: index + 1,
            chunks,
            // One chunk → readable object; several → concatenate `data` in chunk order.
            ...(chunks === 1 ? { value: JSON.parse(slice) } : { data: slice }),
          },
          "prospectus.diag.payload"
        );
      }
    } catch (error) {
      reportDiagFailure(`${parentEvent}#${field}`, error);
    }
  }
}

/** Run one request inside a diagnostic context so nested logs share ids. */
export function runProspectusDiag<T>(ctx: ProspectusDiagContext, fn: () => Promise<T>): Promise<T> {
  if (diagMode() === "off") return fn();
  return storage.run({ ctx, reqSeq: 0, stash: {} }, async () => {
    try {
      return await fn();
    } catch (error) {
      // Logged here so the event keeps the request context; rethrown unchanged.
      prospectusDiagError(ctx.operation ?? "unknown", error);
      throw error;
    }
  });
}

/**
 * Emit one structured diagnostic event.
 * `build` returns the compact summary; `raw` returns heavy objects, sent as chunked
 * `prospectus.diag.payload` events so a large body cannot break the summary line.
 */
export function prospectusDiag(
  event: string,
  build: () => Record<string, unknown>,
  raw?: () => Record<string, unknown>
): void {
  const mode = diagMode();
  if (mode === "off") return;
  try {
    const base = baseFields(event);
    logger.info({ ...base, ...build() }, event);
    if (raw && mode === "full") emitRawPayloads(event, base.seq, raw());
  } catch (error) {
    reportDiagFailure(event, error);
  }
}

export function setProspectusDiagStash(key: string, value: unknown): void {
  const store = storage.getStore();
  if (store) store.stash[key] = value;
}

const loggedErrors = new WeakMap<object, string>();

function classifyProspectusError(operation: string, error: unknown): string {
  const e = error as { name?: string; statusCode?: number } | null;
  if (operation.includes("post_merge")) return "post_merge";
  if (operation.includes("snapshot")) return "snapshot";
  if (operation.includes("fingerprint")) return "fingerprint";
  if (e?.statusCode === 409) return "conflict";
  if (e?.statusCode === 422 || e?.name === "ZodError") return "validation";
  if (typeof e?.name === "string" && e.name.startsWith("PrismaClient")) return "db_update";
  if (operation.includes("transaction") || operation.includes("write")) return "db_update";
  return "other";
}

/** `prospectus.error` — one per failing operation, including 4xx AppErrors. */
export function prospectusDiagError(
  operation: string,
  error: unknown,
  extra?: () => Record<string, unknown>
): void {
  if (diagMode() === "off") return;
  try {
    const e = error as {
      name?: string;
      code?: unknown;
      statusCode?: number;
      message?: string;
      details?: unknown;
      meta?: unknown;
      issues?: unknown;
      stack?: string;
    } | null;
    const innerOperation =
      error && typeof error === "object" ? loggedErrors.get(error) ?? null : null;
    // Same operation already reported this error (e.g. request wrapper, then controller catch).
    if (innerOperation === operation) return;
    if (error && typeof error === "object" && !innerOperation) loggedErrors.set(error, operation);
    logger.error(
      {
        ...baseFields("prospectus.error"),
        operation,
        innerOperation,
        errorKind: classifyProspectusError(innerOperation ?? operation, error),
        errorType: e?.name ?? typeof error,
        errorCode: e?.code ?? null,
        statusCode: e?.statusCode ?? null,
        message: e?.message ?? String(error),
        details: e?.details ?? e?.issues ?? null,
        prismaMeta: e?.meta ?? null,
        statusBeforeFailure: storage.getStore()?.stash.reviewStatus ?? null,
        stack: e?.stack ?? null,
        ...(extra ? extra() : {}),
      },
      "prospectus.error"
    );
  } catch (diagError) {
    reportDiagFailure("prospectus.error", diagError);
  }
}

/** Log-and-rethrow around one call; the thrown error is unchanged. */
export async function withProspectusDiagError<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    prospectusDiagError(operation, error);
    throw error;
  }
}

/** `.catch(prospectusDiagRethrow(op))` — logs the rejection and rethrows it unchanged. */
export function prospectusDiagRethrow(operation: string) {
  return (error: unknown): never => {
    prospectusDiagError(operation, error);
    throw error;
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** What the value looks like after a JSONB write + read. */
function jsonRoundTrip(value: unknown): unknown {
  if (value === undefined) return undefined;
  const text = JSON.stringify(value);
  return text === undefined ? undefined : JSON.parse(text);
}

/** Hash per top-level key, so two logs show which key moved. */
export function diagKeyHashes(value: unknown, hash: DiagHash): Record<string, string> | null {
  if (!isPlainRecord(value)) return null;
  const out: Record<string, string> = {};
  for (const key of Object.keys(value).sort()) out[key] = diagSafeHash(hash, value[key]);
  return out;
}

/** Top-level keys whose canonical hash differs between two objects. */
export function diagChangedKeys(before: unknown, after: unknown, hash: DiagHash): string[] {
  const a = isPlainRecord(before) ? before : {};
  const b = isPlainRecord(after) ? after : {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys]
    .filter((key) => diagSafeHash(hash, a[key]) !== diagSafeHash(hash, b[key]))
    .sort();
}

type ReviewRowLike = {
  id: string;
  note_id: string;
  status: string;
  content_version: number;
  option_catalogue_version: string;
  draft_content: unknown;
  approved_content: unknown;
  approved_snapshot: unknown;
  approved_publication_id: string | null;
  render_fingerprint: string | null;
  created_by_user_id: string;
  updated_by_user_id: string;
  approved_by_user_id: string | null;
  approved_at: Date | null;
  updated_at: Date;
};

/** Compact, comparable state of a review row (raw DB status, no content bodies). */
export function reviewRowDiag(row: ReviewRowLike | null | undefined, hash: DiagHash) {
  if (!row) return null;
  const snapshot = isPlainRecord(row.approved_snapshot) ? row.approved_snapshot : null;
  return {
    reviewId: row.id,
    noteId: row.note_id,
    status: row.status,
    updatedAt: row.updated_at?.toISOString?.() ?? null,
    updatedAtMs: row.updated_at?.getTime?.() ?? null,
    contentVersion: row.content_version,
    optionCatalogueVersion: row.option_catalogue_version,
    renderFingerprint: row.render_fingerprint,
    snapshotRenderFingerprint: snapshot?.render_fingerprint ?? null,
    draftContentHash: row.draft_content != null ? diagSafeHash(hash, row.draft_content) : null,
    approvedContentHash:
      row.approved_content != null ? diagSafeHash(hash, row.approved_content) : null,
    approvedSnapshotHash: snapshot ? diagSafeHash(hash, snapshot) : null,
    publicationId: row.approved_publication_id,
    approvedAt: row.approved_at?.toISOString?.() ?? null,
    approvedByUserId: row.approved_by_user_id,
    updatedByUserId: row.updated_by_user_id,
    createdByUserId: row.created_by_user_id,
    hasDraftContent: row.draft_content != null,
    hasApprovedContent: row.approved_content != null,
    hasApprovedSnapshot: row.approved_snapshot != null,
  };
}

/** Approved snapshot without HTML bodies (length + hash only). */
export function approvedSnapshotDiag(snapshot: unknown): unknown {
  if (!isPlainRecord(snapshot)) return snapshot;
  const html = isPlainRecord(snapshot.html) ? snapshot.html : {};
  const htmlSummary: Record<string, unknown> = {};
  for (const [page, body] of Object.entries(html)) {
    htmlSummary[page] =
      typeof body === "string" ? { chars: body.length, sha256: sha256(body) } : body;
  }
  return { ...snapshot, html: htmlSummary };
}

type FingerprintSourceMeta = Record<string, unknown>;
const fingerprintSourceMeta = new WeakMap<object, FingerprintSourceMeta>();

/** Attach ids/timestamps to the loaded fingerprint source without changing its shape. */
export function rememberFingerprintSourceMeta(source: object, meta: FingerprintSourceMeta): void {
  try {
    fingerprintSourceMeta.set(source, meta);
  } catch {
    // Diagnostics only.
  }
}

const fingerprintSummaries = new Map<string, Record<string, unknown>>();

/** Summary of the input that produced a fingerprint value, if it was logged in this process. */
export function getFingerprintDiagSummary(
  fingerprint: string | null | undefined
): Record<string, unknown> | null {
  if (!fingerprint) return null;
  return fingerprintSummaries.get(fingerprint) ?? null;
}

const NOTE_SCALAR_KEYS = [
  "note_id",
  "note_reference",
  "title",
  "issuer_organization_id",
  "target_amount",
  "funded_amount",
  "profit_rate_percent",
  "service_fee_rate_percent",
  "platform_fee_rate_percent",
  "maturity_date",
  "listing_opens_at",
  "listing_closes_at",
] as const;

/**
 * `prospectus.fingerprint.components` — one hash per component of the render fingerprint,
 * plus the hash of the same component after a JSON round trip (what a later GET reads back).
 */
export function logFingerprintComponents(input: {
  phase: "approve" | "recompute";
  noteId: string;
  parts: { draft: string; sources: Record<string, unknown>; page_1: unknown; page_2: unknown };
  fingerprint: string;
  hash: DiagHash;
  /** Recompute only: note identity frozen at approve, for a per-key comparison. */
  storedNoteIdentity?: unknown;
  storedFingerprint?: string | null;
}): void {
  if (diagMode() === "off") return;
  const { parts } = input;
  const hash: DiagHash = (value) => diagSafeHash(input.hash, value);
  let components: Record<string, unknown> = {};
  prospectusDiag(
    "prospectus.fingerprint.components",
    () => {
      const noteIdentity = isPlainRecord(parts.sources.note_identity)
        ? parts.sources.note_identity
        : {};
      const note: Record<string, unknown> = {};
      for (const key of NOTE_SCALAR_KEYS) note[key] = noteIdentity[key];
      const meta = fingerprintSourceMeta.get(parts.sources) ?? {};
      components = {
        note,
        application: meta.application ?? null,
        financialStatements: parts.sources.financial_statements,
        ctos: parts.sources.ctos_financials,
        marc: noteIdentity.marc_snapshot,
        invoice: noteIdentity.invoice_snapshot,
        contract: noteIdentity.contract_snapshot,
        product: noteIdentity.product_snapshot,
        purpose: noteIdentity.purpose_snapshot,
        paymaster: noteIdentity.paymaster_snapshot,
        issuer: noteIdentity.issuer_snapshot,
        frozenPage1: parts.page_1,
        frozenPage2: parts.page_2,
      };
      const hashNames: Record<string, string> = {
        note: "noteHash",
        application: "applicationHash",
        financialStatements: "financialHash",
        ctos: "ctosHash",
        marc: "marcHash",
        invoice: "invoiceHash",
        contract: "contractHash",
        product: "productHash",
        purpose: "purposeHash",
        paymaster: "paymasterHash",
        issuer: "issuerHash",
        frozenPage1: "page1Hash",
        frozenPage2: "page2Hash",
      };
      const hashes: Record<string, string> = {};
      const roundTripHashes: Record<string, string> = {};
      const changedByJsonRoundTrip: string[] = [];
      for (const [name, value] of Object.entries(components)) {
        const label = hashNames[name];
        hashes[label] = hash(value);
        roundTripHashes[label] = hash(jsonRoundTrip(value));
        if (hashes[label] !== roundTripHashes[label]) changedByJsonRoundTrip.push(label);
      }
      hashes.contentHash = parts.draft;

      const storedIdentity = isPlainRecord(input.storedNoteIdentity)
        ? // The fingerprint always nulls listing dates; compare like for like.
          { ...input.storedNoteIdentity, listing_opens_at: null, listing_closes_at: null }
        : null;
      const roundTripFingerprint = hash(jsonRoundTrip(parts));
      const summary = {
        phase: input.phase,
        noteId: input.noteId,
        noteReference: noteIdentity.note_reference ?? null,
        fingerprint: input.fingerprint,
        storedFingerprint: input.storedFingerprint ?? null,
        matchesStored:
          input.storedFingerprint == null ? null : input.storedFingerprint === input.fingerprint,
        // If this differs from `fingerprint`, a GET that hashes the JSONB copy cannot match.
        roundTripFingerprint,
        fingerprintSurvivesJsonRoundTrip: roundTripFingerprint === input.fingerprint,
        changedByJsonRoundTrip,
        hashes,
        roundTripHashes,
        sourcesHash: hash(parts.sources),
        noteIdentityHash: hash(noteIdentity),
        noteIdentityKeyHashes: diagKeyHashes(noteIdentity, hash),
        financialKeyHashes: diagKeyHashes(parts.sources.financial_statements, hash),
        ctosKeyHashes: diagKeyHashes(parts.sources.ctos_financials, hash),
        marcKeyHashes: diagKeyHashes(noteIdentity.marc_snapshot, hash),
        page1KeyHashes: diagKeyHashes(parts.page_1, hash),
        page2KeyHashes: diagKeyHashes(parts.page_2, hash),
        sourceMeta: meta,
        note,
        changedNoteIdentityKeysVsApprovedSnapshot: storedIdentity
          ? diagChangedKeys(storedIdentity, noteIdentity, hash)
          : null,
        changedNoteIdentityKeysVsApprovedSnapshotAfterRoundTrip: storedIdentity
          ? diagChangedKeys(storedIdentity, jsonRoundTrip(noteIdentity), hash)
          : null,
      };
      fingerprintSummaries.set(input.fingerprint, summary);
      if (fingerprintSummaries.size > FINGERPRINT_SUMMARY_LIMIT) {
        const oldest = fingerprintSummaries.keys().next().value;
        if (oldest !== undefined) fingerprintSummaries.delete(oldest);
      }
      return summary;
    },
    () => ({
      ...components,
      ...(input.storedNoteIdentity !== undefined
        ? { storedNoteIdentity: input.storedNoteIdentity }
        : {}),
    })
  );
}

/** Component hash names that differ between two fingerprint summaries (null if either is unknown). */
export function diffFingerprintDiagSummaries(
  previous: Record<string, unknown> | null,
  current: Record<string, unknown> | null
): string[] | null {
  const a = previous && isPlainRecord(previous.hashes) ? previous.hashes : null;
  const b = current && isPlainRecord(current.hashes) ? current.hashes : null;
  if (!a || !b) return null;
  const names = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...names].filter((name) => a[name] !== b[name]).sort();
}
