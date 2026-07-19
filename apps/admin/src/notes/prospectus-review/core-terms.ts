import { formatCurrency } from "@cashsouk/config";
import {
  MARKETPLACE_MIN_COMMIT_MYR,
  calculateCalendarDayCount,
  formatInvestorReturnRatePercent,
  formatUtcCalendarDateEnMy,
  isSoukscoreRiskRating,
  resolveNetExpectedReturnRatePercent,
  type NoteDetail,
} from "@cashsouk/types";

const DATA_NOT_AVAILABLE = "Data not available";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function textOrDash(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  return "—";
}

function textOrDna(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  return DATA_NOT_AVAILABLE;
}

/** Prospectus-aligned UTC calendar date; DNA when missing. */
function formatProspectusAlignedDate(value: string | null | undefined): string {
  return formatUtcCalendarDateEnMy(value) ?? DATA_NOT_AVAILABLE;
}

/**
 * Tenure = calculateCalendarDayCount(opens_at, maturity_date), same as Page 1 prospectus.
 * Does not use investor days-left helpers.
 */
function formatProspectusAlignedTenure(
  opensAt: string | null | undefined,
  maturity: string | null | undefined
): string {
  if (!opensAt || !maturity) return DATA_NOT_AVAILABLE;
  const start = new Date(opensAt);
  const end = new Date(maturity);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return DATA_NOT_AVAILABLE;
  }
  return `${calculateCalendarDayCount(start, end)} days`;
}

function formatRatePercent(rate: number | null | undefined): string {
  if (rate == null || !Number.isFinite(rate)) return DATA_NOT_AVAILABLE;
  const label = formatInvestorReturnRatePercent(rate);
  return label === "-" ? DATA_NOT_AVAILABLE : label;
}

export type CoreTermRow = { label: string; value: string };

export type NoteInvestmentDetailSection = {
  id: string;
  title: string;
  rows: CoreTermRow[];
};

export type CatalogueOption = { key: string; label: string };

/** Resolve officer-selected catalogue wording for read-only coverage. */
export function resolveCatalogueOptionLabel(
  options: CatalogueOption[] | undefined,
  optionKey: string | null | undefined
): string {
  if (!optionKey || !optionKey.trim()) return "Not selected";
  const found = options?.find((o) => o.key === optionKey);
  if (found?.label?.trim()) return found.label.trim();
  if (optionKey === "do_not_display") return "Do not display";
  return "Not selected";
}

/**
 * Page 1 Note & Investment Details — grouped read-only coverage for operations.
 * Does not change source formulas; Profit Rate = gross, Expected Return = net helper.
 */
export function buildNoteInvestmentDetailSections(
  note: NoteDetail,
  resolved?: {
    paymentBasisLabel?: string;
    shariahPrincipleLabel?: string;
  }
): NoteInvestmentDetailSection[] {
  const purpose = asRecord(note.purposeSnapshot);
  const product = asRecord(note.productSnapshot);
  const paymaster = asRecord(note.paymasterSnapshot);

  const financingType =
    (typeof product?.product_name === "string" && product.product_name) ||
    note.productName ||
    note.productCategory ||
    "—";
  const productDescription =
    typeof product?.description === "string" && product.description.trim()
      ? product.description.trim()
      : "—";

  // Same sources as Page 1 prospectus Stage 2 — no publishedAt/createdAt fallbacks.
  const opensAt = note.listing?.opensAt ?? null;
  const closesAt = note.listing?.closesAt ?? note.listingClosesAt ?? null;
  const tenure = formatProspectusAlignedTenure(opensAt, note.maturityDate);
  const financingAmount = formatCurrency(note.targetAmount);
  const minimumInvestment = formatCurrency(MARKETPLACE_MIN_COMMIT_MYR);
  const profitRate = formatRatePercent(note.profitRatePercent);
  const expectedReturn = formatRatePercent(
    resolveNetExpectedReturnRatePercent({
      profitRatePercent: note.profitRatePercent,
      serviceFeeRatePercent: note.serviceFeeRatePercent,
    })
  );

  const paymasterName = textOrDna(note.paymasterName ?? paymaster?.name);
  const natureOfPaymaster = textOrDna(
    paymaster?.entity_type ?? paymaster?.entityType ?? paymaster?.type
  );

  return [
    {
      id: "note-details",
      title: "Note Details",
      rows: [
        { label: "Note Reference", value: note.noteReference },
        { label: "Financing Type", value: textOrDash(financingType) },
        { label: "Product Description", value: productDescription },
      ],
    },
    {
      id: "dates-paymaster",
      title: "Dates & Paymaster",
      rows: [
        { label: "Listing Date", value: formatProspectusAlignedDate(opensAt) },
        { label: "Closing Date", value: formatProspectusAlignedDate(closesAt) },
        {
          label: "Maturity Date",
          value: formatProspectusAlignedDate(note.maturityDate),
        },
        { label: "Tenure", value: tenure },
        { label: "Paymaster", value: paymasterName },
        { label: "Nature of Paymaster", value: natureOfPaymaster },
      ],
    },
    {
      id: "investment-terms",
      title: "Investment Terms",
      rows: [
        { label: "Financing Amount", value: financingAmount },
        { label: "Minimum Investment", value: minimumInvestment },
        { label: "Profit Rate (p.a.)", value: profitRate },
        { label: "Expected Return (p.a.)", value: expectedReturn },
        {
          label: "Purpose of Financing",
          value: textOrDash(purpose?.financing_for),
        },
        {
          label: "Payment Basis",
          value: resolved?.paymentBasisLabel ?? "Not selected",
        },
        {
          label: "Shariah Principle",
          value: resolved?.shariahPrincipleLabel ?? "Not selected",
        },
      ],
    },
    {
      id: "risk-information",
      title: "Risk Information",
      rows: [
        {
          label: "Risk Rating",
          // NoteDetail.riskRating is mapped from invoice_snapshot.offer_details.risk_rating.
          value: isSoukscoreRiskRating(note.riskRating)
            ? note.riskRating
            : DATA_NOT_AVAILABLE,
        },
        // Unresolved until product/legal approve SoukScore label copy — keep visible as DNA.
        { label: "Risk Label", value: DATA_NOT_AVAILABLE },
        // Unresolved until product/legal approve grade explanations — keep visible as DNA.
        { label: "Risk Explanation", value: DATA_NOT_AVAILABLE },
      ],
    },
    {
      id: "at-a-glance",
      title: "At a Glance",
      rows: [
        { label: "Financing Amount", value: financingAmount },
        { label: "Profit Rate (p.a.)", value: profitRate },
        { label: "Expected Return (p.a.)", value: expectedReturn },
        { label: "Tenure", value: tenure },
        { label: "Minimum Investment", value: minimumInvestment },
      ],
    },
    // Issuer Track Record / Historical Notes stay prospectus-preview-only until
    // admin can load the same derived values; omit preview-only placeholder rows.
  ];
}

/** @deprecated Prefer buildNoteInvestmentDetailSections for grouped coverage. */
export function buildCoreTermsRows(note: NoteDetail): CoreTermRow[] {
  return buildNoteInvestmentDetailSections(note).flatMap((section) => section.rows);
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
