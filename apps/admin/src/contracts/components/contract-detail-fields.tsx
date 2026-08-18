import * as React from "react";
import { format } from "date-fns";
import { formatCurrency } from "@cashsouk/config";
import { formatPhaseDeadlineAbsolute } from "@cashsouk/types";
import { formatFileSize } from "@/components/application-review/review-section-styles";

export const CONTRACT_EMPTY_LABEL = "Not provided";

export type ContractFileDoc = {
  s3_key?: string;
  file_name?: string;
  file_size?: number;
};

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

/** Formats a raw `contractDetails` / `offerDetails` JSON value for display. */
export function formatContractFieldValue(key: string, value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (key === "facility_fee_rate_percent") {
    const rate = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(rate)) return "—";
    return `${Math.round(rate * 100) / 100}%`;
  }
  if (typeof value === "number") {
    if (
      key.includes("value") ||
      key.includes("facility") ||
      key.includes("amount") ||
      key.includes("financing")
    ) {
      return formatCurrency(value);
    }
    return value.toLocaleString();
  }
  if (key === "acceptance_expires_at" || key === "signing_expires_at") {
    if (isIsoDate(value)) return formatPhaseDeadlineAbsolute(value);
  }
  const lowerKey = key.toLowerCase();
  if (
    (lowerKey.includes("date") || lowerKey.endsWith("_at") || lowerKey === "updated") &&
    isIsoDate(value)
  ) {
    return format(new Date(value), "dd MMM yyyy");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function ContractDetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="py-2">
      <p className="text-meta text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-words text-ui font-medium">{value}</p>
    </div>
  );
}

const DYNAMIC_ROW_LABEL_OVERRIDES: Record<string, string> = {
  facility_fee_paid_amount: "Facility fee collected",
  facility_fee_rate_percent: "Facility fee rate",
};

function humanizeKey(key: string) {
  return (
    DYNAMIC_ROW_LABEL_OVERRIDES[key] ??
    key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

export function contractDynamicKeys(
  data: Record<string, unknown> | null | undefined,
  exclude: string[] = []
): string[] {
  if (!data) return [];
  return Object.keys(data).filter((key) => !exclude.includes(key));
}

/** Renders whatever snake_case fields the payload carries beyond the curated set. */
export function ContractDynamicRows({
  data,
  exclude = [],
}: {
  data: Record<string, unknown> | null | undefined;
  exclude?: string[];
}) {
  const keys = contractDynamicKeys(data, exclude);
  if (!data || keys.length === 0) return null;

  return (
    <div>
      {keys.map((key) => (
        <ContractDetailRow
          key={key}
          label={humanizeKey(key)}
          value={formatContractFieldValue(key, data[key])}
        />
      ))}
    </div>
  );
}

export function hasContractOfferData(offer: Record<string, unknown> | null): boolean {
  if (!offer) return false;
  return Object.values(offer).some(
    (value) => value !== null && value !== undefined && value !== ""
  );
}

export function contractFileLabel(doc?: ContractFileDoc) {
  if (!doc?.file_name) return CONTRACT_EMPTY_LABEL;
  if (!doc.file_size) return doc.file_name;
  return `${doc.file_name} (${formatFileSize(doc.file_size)})`;
}
