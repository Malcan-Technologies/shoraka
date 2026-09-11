import type { SigningEnvelopeStatus } from "@cashsouk/types";

const RESYNCABLE_ENVELOPE_STATUSES = new Set<SigningEnvelopeStatus>([
  "SENT",
  "IN_PROGRESS",
  "COMPLETED",
]);

/** Admin Re-sync is for live or completed packages, not draft/closed envelopes. */
export function canResyncAdminSigningEnvelope(
  canManage: boolean,
  status: SigningEnvelopeStatus
): boolean {
  return canManage && RESYNCABLE_ENVELOPE_STATUSES.has(status);
}
