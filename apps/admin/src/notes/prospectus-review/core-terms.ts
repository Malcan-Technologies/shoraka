import { formatCurrency } from "@cashsouk/config";
import {
  MARKETPLACE_MIN_COMMIT_MYR,
  formatInvestorReturnRatePercent,
  resolveNetExpectedReturnRatePercent,
  type NoteDetail,
} from "@cashsouk/types";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function textOrDash(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  return "—";
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function tenureDays(opensAt: string | null | undefined, maturity: string | null | undefined): string {
  if (!opensAt || !maturity) return "—";
  const start = new Date(opensAt);
  const end = new Date(maturity);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "—";
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  if (!Number.isFinite(days) || days < 0) return "—";
  return `${days} days`;
}

export type CoreTermRow = { label: string; value: string };

export function buildCoreTermsRows(note: NoteDetail): CoreTermRow[] {
  const purpose = asRecord(note.purposeSnapshot);
  const product = asRecord(note.productSnapshot);
  const financingType =
    (typeof product?.product_name === "string" && product.product_name) ||
    note.productName ||
    note.productCategory ||
    "—";

  const opensAt = note.listing?.opensAt ?? note.publishedAt ?? note.createdAt;
  const closesAt = note.listing?.closesAt ?? note.listingClosesAt;
  const expectedReturn = resolveNetExpectedReturnRatePercent({
    profitRatePercent: note.profitRatePercent,
    serviceFeeRatePercent: note.serviceFeeRatePercent,
  });

  return [
    { label: "Note Reference", value: note.noteReference },
    { label: "Financing Type", value: textOrDash(financingType) },
    { label: "Listing Date", value: formatDate(opensAt) },
    { label: "Closing Date", value: formatDate(closesAt) },
    { label: "Maturity Date", value: formatDate(note.maturityDate) },
    { label: "Paymaster", value: textOrDash(note.paymasterName) },
    { label: "Financing Amount", value: formatCurrency(note.targetAmount) },
    { label: "Minimum Investment", value: formatCurrency(MARKETPLACE_MIN_COMMIT_MYR) },
    {
      label: "Expected Return",
      value: formatInvestorReturnRatePercent(expectedReturn),
    },
    { label: "Tenure", value: tenureDays(opensAt, note.maturityDate) },
    {
      label: "Purpose of Financing",
      value: textOrDash(purpose?.financing_for),
    },
    { label: "Risk Rating", value: textOrDash(note.riskRating) },
  ];
}

export function buildIssuerProfileRows(note: NoteDetail): CoreTermRow[] {
  const issuer = asRecord(note.issuerSnapshot);
  return [
    { label: "Industry", value: textOrDash(issuer?.industry ?? note.issuerIndustry) },
    {
      label: "Entity Type",
      value: textOrDash(issuer?.entity_type ?? issuer?.type),
    },
    { label: "Company Size", value: "—" },
    { label: "Registered Country", value: textOrDash(issuer?.country) },
    {
      label: "Business Description",
      value: textOrDash(issuer?.business_description),
    },
  ];
}

export function readUnauditedYear(
  financialStatements: unknown,
  year: string
): Record<string, unknown> {
  const root = asRecord(financialStatements);
  const byYear = asRecord(root?.unaudited_by_year);
  return asRecord(byYear?.[year]) ?? {};
}

export function formatDerivedMoney(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return formatCurrency(value);
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(/,/g, ""));
    if (Number.isFinite(parsed)) return formatCurrency(parsed);
  }
  return "—";
}

export function formatDerivedRatio(numerator: unknown, denominator: unknown): string {
  const n =
    typeof numerator === "number"
      ? numerator
      : typeof numerator === "string"
        ? Number(String(numerator).replace(/,/g, ""))
        : NaN;
  const d =
    typeof denominator === "number"
      ? denominator
      : typeof denominator === "string"
        ? Number(String(denominator).replace(/,/g, ""))
        : NaN;
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return "—";
  return `${(n / d).toFixed(2)}x`;
}

export function formatDerivedPercent(part: unknown, whole: unknown): string {
  const n =
    typeof part === "number"
      ? part
      : typeof part === "string"
        ? Number(String(part).replace(/,/g, ""))
        : NaN;
  const d =
    typeof whole === "number"
      ? whole
      : typeof whole === "string"
        ? Number(String(whole).replace(/,/g, ""))
        : NaN;
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
}
