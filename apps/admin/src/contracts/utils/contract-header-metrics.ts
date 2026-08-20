import { format } from "date-fns";
import { formatCurrency } from "@cashsouk/config";
import {
  parseFacilityAmount,
  resolveContractFacilityFeeCollected,
} from "./contract-facility-metrics";

export type ContractHeaderMetric = {
  label: string;
  value: string;
};

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function formatHeaderDate(value: unknown): string {
  if (value == null || value === "") return "Not set";
  if (isIsoDate(value)) return format(new Date(value), "dd MMM yyyy");
  return String(value);
}

function formatHeaderMoney(value: unknown): string {
  if (value == null || value === "") return "Not set";
  const amount = parseFacilityAmount(value);
  if (amount == null) return String(value);
  return formatCurrency(amount);
}

/** End date for the facility hero KPI card. */
export function getContractHeaderEndDate(
  contractDetails: Record<string, unknown> | null | undefined
): string {
  return formatHeaderDate(contractDetails?.end_date);
}

/** Compact commercial facts for the contract detail header. Omits created/updated. */
export function getContractHeaderMetrics(
  contractDetails: Record<string, unknown> | null | undefined,
  options?: { approvedFacility?: number }
): ContractHeaderMetric[] {
  const approved =
    options?.approvedFacility != null
      ? options.approvedFacility
      : parseFacilityAmount(contractDetails?.approved_facility) ?? 0;
  const facilityFee = resolveContractFacilityFeeCollected({
    approved,
    facilityFeeRatePercent: contractDetails?.facility_fee_rate_percent,
    facilityFeePaidAmount: contractDetails?.facility_fee_paid_amount,
  });

  return [
    { label: "Start date", value: formatHeaderDate(contractDetails?.start_date) },
    { label: "Contract value", value: formatHeaderMoney(contractDetails?.value) },
    {
      label: "Approved facility",
      value: formatHeaderMoney(
        options?.approvedFacility != null
          ? options.approvedFacility
          : contractDetails?.approved_facility
      ),
    },
    {
      label: "Facility fee collected",
      value: facilityFee?.display ?? "Not set",
    },
  ];
}

export function resolveContractHeaderDescription(input: {
  title?: string | null;
  description?: string | null;
  contractDetails?: Record<string, unknown> | null;
}): string | null {
  const raw = input.description ?? input.contractDetails?.description;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const title = input.title?.trim() || "";
  if (trimmed === title) return null;
  return trimmed;
}
