import type { Prisma } from "@prisma/client";

const MALAYSIA_TZ = "Asia/Kuala_Lumpur";

/** YYYYMMDD in Asia/Kuala_Lumpur for the given instant. */
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

export function formatReceiptNumber(dateKey: string, sequence: number): string {
  if (!/^\d{8}$/.test(dateKey)) {
    throw new Error("Invalid receipt date key");
  }
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 999) {
    throw new Error("Receipt daily sequence out of range (1-999)");
  }
  return `RCP-${dateKey}-${String(sequence).padStart(3, "0")}`;
}

/**
 * Atomically allocate the next RCP-YYYYMMDD-NNN number using a daily counter row.
 * Must run inside a Prisma interactive transaction.
 */
export async function allocateReceiptNumber(
  tx: Prisma.TransactionClient,
  now: Date = new Date()
): Promise<string> {
  const dateKey = getMalaysiaDateKey(now);

  const rows = await tx.$queryRaw<Array<{ last_value: number }>>`
    INSERT INTO receipt_daily_counters (date_key, last_value, updated_at)
    VALUES (${dateKey}, 1, NOW())
    ON CONFLICT (date_key)
    DO UPDATE SET
      last_value = receipt_daily_counters.last_value + 1,
      updated_at = NOW()
    RETURNING last_value
  `;

  const sequence = rows[0]?.last_value;
  if (sequence === undefined) {
    throw new Error("Failed to allocate receipt number sequence");
  }

  return formatReceiptNumber(dateKey, sequence);
}
