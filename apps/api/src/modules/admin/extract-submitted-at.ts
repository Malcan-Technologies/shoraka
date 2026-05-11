export function extractSubmittedAtFromWebhookPayloads(params: {
  webhookPayloads: unknown;
  onboardingStatus: string;
  completedAt: Date | null;
}): string | null {
  const { webhookPayloads, onboardingStatus, completedAt } = params;

  // Business rule: when org is waiting for amendment resubmission, the amended submission
  // is not ready for admin review yet.
  if (onboardingStatus === "PENDING_AMENDMENT") return null;

  if (!Array.isArray(webhookPayloads)) {
    return completedAt ? completedAt.toISOString() : null;
  }

  let latestMs: number | null = null;

  for (const raw of webhookPayloads) {
    const payloadObj = parseUnknownJsonValueToPlainObject(raw);
    if (!payloadObj) continue;

    const statusUpper = (payloadObj.status as unknown as string | undefined)?.toUpperCase();
    if (statusUpper !== "WAIT_FOR_APPROVAL") continue;

    const ts = payloadObj.timestamp as unknown;
    const ms = timestampToMs(ts);
    if (ms === null) continue;

    if (latestMs === null || ms > latestMs) {
      latestMs = ms;
    }
  }

  if (latestMs === null) return completedAt ? completedAt.toISOString() : null;
  return new Date(latestMs).toISOString();
}

function parseUnknownJsonValueToPlainObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Ignore invalid JSON strings
    }
  }

  return null;
}

function timestampToMs(ts: unknown): number | null {
  if (typeof ts === "number") {
    return Number.isFinite(ts) ? ts : null;
  }
  if (typeof ts === "string") {
    const ms = Date.parse(ts);
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

