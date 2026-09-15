/**
 * Durable envelope send phases stored on signing_envelopes.
 */
import type { SigningEnvelopeSendPhase } from "@cashsouk/types";
import { signingEnvelopeSendInProgress } from "@cashsouk/types";

export const ENVELOPE_SEND_STALE_MS = 10 * 60 * 1000;

export type EnvelopeSendState = {
  phase: SigningEnvelopeSendPhase;
  inProgress: boolean;
  error: string | null;
  startedAt: string | null;
};

export function isEnvelopeSendStale(input: {
  phase: SigningEnvelopeSendPhase | null | undefined;
  startedAt: Date | string | null | undefined;
  now?: number;
}): boolean {
  if (!signingEnvelopeSendInProgress(input.phase ?? undefined)) return false;
  if (!input.startedAt) return true;
  const startedMs =
    input.startedAt instanceof Date ? input.startedAt.getTime() : Date.parse(input.startedAt);
  if (!Number.isFinite(startedMs)) return true;
  return (input.now ?? Date.now()) - startedMs > ENVELOPE_SEND_STALE_MS;
}

export function readEnvelopeSendState(input: {
  send_phase?: SigningEnvelopeSendPhase | null;
  send_error?: string | null;
  send_started_at?: Date | string | null;
}): EnvelopeSendState {
  const phase = input.send_phase ?? "IDLE";
  const startedAt =
    input.send_started_at instanceof Date
      ? input.send_started_at.toISOString()
      : typeof input.send_started_at === "string" && input.send_started_at.trim()
        ? input.send_started_at
        : null;
  const error = typeof input.send_error === "string" && input.send_error.trim() ? input.send_error : null;
  if (isEnvelopeSendStale({ phase, startedAt })) {
    return {
      phase: "FAILED",
      inProgress: false,
      error: error ?? "Sending signing links timed out. Try again.",
      startedAt,
    };
  }
  return {
    phase,
    inProgress: signingEnvelopeSendInProgress(phase),
    error,
    startedAt,
  };
}
