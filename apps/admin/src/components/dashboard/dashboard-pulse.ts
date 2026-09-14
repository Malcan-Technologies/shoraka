import { formatCurrency } from "@cashsouk/config";
import {
  par90LimitStatus,
  SC_PAR90_LIMIT_PERCENT,
  type Par90LimitStatus,
} from "@cashsouk/types";

export function ledgerPulseCopy(balance: number): {
  label: "Balanced" | "Negative";
  tone: "success" | "rejected";
  netLabel: string;
} {
  const balanced = balance >= 0;
  return {
    label: balanced ? "Balanced" : "Negative",
    tone: balanced ? "success" : "rejected",
    netLabel: `${formatCurrency(balance)} net`,
  };
}

export function par90PulseCopy(percent: number): {
  percentLabel: string;
  status: Par90LimitStatus;
  subtitle: string;
  tone: "success" | "rejected";
} {
  const status = par90LimitStatus(percent);
  return {
    percentLabel: `${percent.toFixed(1)}%`,
    status,
    subtitle: `limit ${SC_PAR90_LIMIT_PERCENT.toFixed(1)}% · SC test`,
    tone: status === "inside" ? "success" : "rejected",
  };
}

export function distressedPulseCopy(
  arrearsCount: number,
  defaultedCount: number
): {
  total: number;
  subtitle: string;
  tone: "rejected" | "neutral";
} {
  const total = arrearsCount + defaultedCount;
  return {
    total,
    subtitle: `${arrearsCount} arrears · ${defaultedCount} default`,
    tone: total > 0 ? "rejected" : "neutral",
  };
}

export function workQueuedPulseCopy(
  totalOpenItems: number,
  queueCount: number
): {
  itemsLabel: string;
  subtitle: string;
} {
  return {
    itemsLabel: String(totalOpenItems),
    subtitle: `items · ${queueCount} ${queueCount === 1 ? "queue" : "queues"}`,
  };
}
