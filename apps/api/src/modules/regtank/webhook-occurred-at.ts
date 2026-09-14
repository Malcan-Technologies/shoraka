export function webhookOccurredAt(timestamp: string | undefined, fallback = new Date()): Date {
  if (!timestamp) {
    return fallback;
  }

  const occurredAt = new Date(timestamp);
  return Number.isNaN(occurredAt.getTime()) ? fallback : occurredAt;
}
