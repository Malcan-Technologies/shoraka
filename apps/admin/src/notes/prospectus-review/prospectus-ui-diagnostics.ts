// TEMP PROSPECTUS DIAGNOSTIC — remove after investigation
/**
 * SECTION: Temporary Prospectus review UI diagnostics
 * WHY: Reconstruct Approve → toast → "still Draft" from the browser console. Logging only.
 *
 * Each log carries `correlationId` from the API response body where one exists, which is the
 * same id the API writes on its own `prospectus.*` logs.
 */

const DIAG_MARKER = "TEMP_PROSPECTUS_DIAGNOSTIC";

let seq = 0;
let flowId: string | null = null;
const lastSignatures = new Map<string, string>();

function enabled() {
  return process.env.NODE_ENV !== "test";
}

/** Start a new flow id at each Approve click; later logs carry it until the next one. */
export function beginProspectusUiFlow(noteId: string): string {
  flowId = `${noteId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  return flowId;
}

export function prospectusUiDiag(event: string, payload: Record<string, unknown>): void {
  if (!enabled()) return;
  try {
    seq += 1;
    const now = Date.now();
    console.info(event, {
      diag: DIAG_MARKER,
      event,
      ts: now,
      iso: new Date(now).toISOString(),
      seq,
      flowId,
      ...payload,
    });
  } catch {
    // Diagnostics must never affect the page.
  }
}

/** Same as prospectusUiDiag, but only when the payload differs from the last one for `key`. */
export function prospectusUiDiagOnChange(
  event: string,
  key: string,
  payload: Record<string, unknown>
): void {
  if (!enabled()) return;
  try {
    const signature = JSON.stringify(payload);
    if (lastSignatures.get(key) === signature) return;
    lastSignatures.set(key, signature);
  } catch {
    // Fall through and log.
  }
  prospectusUiDiag(event, payload);
}

export function prospectusUiDiagError(
  operation: string,
  error: unknown,
  extra: Record<string, unknown> = {}
): void {
  const e = error as { name?: string; code?: unknown; message?: string; stack?: string } | null;
  prospectusUiDiag("prospectus.ui.error", {
    operation,
    errorType: e?.name ?? typeof error,
    errorCode: e?.code ?? null,
    message: e?.message ?? String(error),
    stack: e?.stack ?? null,
    ...extra,
  });
}
