import { formatCurrency } from "@cashsouk/config";
import type { LedgerBucketGroupId, LedgerBucketOverviewGroup } from "@/lib/ledger-bucket-display";

const DONUT_RADIUS = 52;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

export const LEDGER_GROUP_STROKE_CLASS: Record<LedgerBucketGroupId, string> = {
  custody: "stroke-status-submitted-text",
  income: "stroke-[hsl(163_88%_40%)] dark:stroke-status-success-text",
  payable: "stroke-status-active-text",
};

export const LEDGER_GROUP_SWATCH_CLASS: Record<LedgerBucketGroupId, string> = {
  custody: "bg-status-submitted-text",
  income: "bg-[hsl(163_88%_40%)] dark:bg-status-success-text",
  payable: "bg-status-active-text",
};

export function formatCompactLedgerAmount(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) {
    const millions = abs / 1_000_000;
    const digits = millions >= 10 ? 1 : 2;
    return `${sign}RM ${millions.toFixed(digits).replace(/\.?0+$/, "")}m`;
  }
  if (abs >= 10_000) {
    const thousands = abs / 1_000;
    return `${sign}RM ${thousands.toFixed(1).replace(/\.0$/, "")}k`;
  }
  return formatCurrency(amount);
}

export function donutSegmentDash(fraction: number, offsetFraction: number): {
  dasharray: string;
  dashoffset: string;
} {
  const clamped = Math.max(0, fraction);
  return {
    dasharray: `${(DONUT_CIRCUMFERENCE * clamped).toFixed(2)} ${DONUT_CIRCUMFERENCE.toFixed(2)}`,
    dashoffset: (-DONUT_CIRCUMFERENCE * offsetFraction).toFixed(2),
  };
}

export function donutGroupFractions(
  groups: Pick<LedgerBucketOverviewGroup, "id" | "held">[],
  heldTotal: number
) {
  let offset = 0;
  return groups.map((group) => {
    const fraction = heldTotal > 0 ? Math.max(group.held, 0) / heldTotal : 0;
    const segment = { id: group.id, fraction, offsetFraction: offset };
    offset += fraction;
    return segment;
  });
}
