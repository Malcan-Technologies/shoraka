const MALAYSIA_TZ = "Asia/Kuala_Lumpur";

/** YYYYMMDD in Asia/Kuala_Lumpur for the given instant. Used for S3 receipt paths. */
export function getMalaysiaDateKey(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MALAYSIA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Failed to resolve Malaysia date key");
  }

  return `${year}${month}${day}`;
}
