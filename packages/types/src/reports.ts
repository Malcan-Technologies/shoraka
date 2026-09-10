export const REPORT_KEYS = [
  "ageing",
  "npl",
  "late_fees",
  "default_recovery",
  "origination",
  "portfolio_composition",
  "investor_book",
  "trust_revenue",
  "comrep",
] as const;

export type ReportKey = (typeof REPORT_KEYS)[number];

export type ReportFormat = "json" | "csv" | "xlsx";

export type ReportFilterKind = "asOf" | "from" | "to";

export const REPORT_BREAKDOWNS = ["start_month", "issuer", "paymaster", "sector"] as const;

export type ReportBreakdown = (typeof REPORT_BREAKDOWNS)[number];

export const REPORT_BREAKDOWN_LABELS: Record<ReportBreakdown, string> = {
  start_month: "Start month",
  issuer: "Issuer",
  paymaster: "Paymaster",
  sector: "Sector",
};

export const REPORT_CATEGORIES = [
  {
    key: "credit_quality",
    label: "Credit quality",
    description: "Ageing, NPL, late fees, and default recovery for the live book.",
  },
  {
    key: "origination",
    label: "Origination",
    description: "Funding outcomes and how the open book is concentrated.",
  },
  {
    key: "investors_treasury",
    label: "Investors & treasury",
    description: "Investor holdings, cash movement, trust buckets, and platform revenue.",
  },
  {
    key: "regulatory",
    label: "Regulatory",
    description: "SC ComRep submissions.",
  },
] as const;

export type ReportCategoryKey = (typeof REPORT_CATEGORIES)[number]["key"];

export interface ReportColumn {
  key: string;
  label: string;
  kind: "text" | "number" | "money" | "percent" | "date" | "boolean";
}

export interface ReportDefinition {
  key: ReportKey;
  title: string;
  description: string;
  available: boolean;
  category: ReportCategoryKey;
  filters: ReportFilterKind[];
  columns: ReportColumn[];
  breakdownOptions?: ReportBreakdown[];
}

export const REPORT_REGISTRY: ReportDefinition[] = [
  {
    key: "ageing",
    title: "Portfolio ageing",
    description:
      "Days past due buckets, PAR30/60/90, outstanding amounts, and indicative late charges.",
    available: true,
    category: "credit_quality",
    filters: ["asOf"],
    columns: [
      { key: "noteReference", label: "Note", kind: "text" },
      { key: "issuerName", label: "Issuer", kind: "text" },
      { key: "servicingStatus", label: "Servicing status", kind: "text" },
      { key: "daysPastDue", label: "DPD", kind: "number" },
      { key: "dpdBucket", label: "Bucket", kind: "text" },
      { key: "outstandingPrincipal", label: "Outstanding principal", kind: "money" },
      { key: "outstandingProfit", label: "Outstanding profit", kind: "money" },
      { key: "indicativeTawidh", label: "Indicative Ta'widh", kind: "money" },
      { key: "indicativeGharamah", label: "Indicative Gharamah", kind: "money" },
    ],
  },
  {
    key: "npl",
    title: "NPL",
    description: "Internal arrears/default exposure and the SC/BNM >90 DPD test.",
    available: true,
    category: "credit_quality",
    filters: ["asOf"],
    columns: [
      { key: "noteReference", label: "Note", kind: "text" },
      { key: "issuerName", label: "Issuer", kind: "text" },
      { key: "servicingStatus", label: "Internal status", kind: "text" },
      { key: "isInternalNpl", label: "Internal NPL", kind: "boolean" },
      { key: "isScDefault", label: "SC >90 DPD", kind: "boolean" },
      { key: "daysPastDue", label: "DPD", kind: "number" },
      { key: "outstandingTotal", label: "Outstanding", kind: "money" },
      { key: "recoveredTotal", label: "Recovered", kind: "money" },
    ],
  },
  {
    key: "late_fees",
    title: "Late fees",
    description: "Ta'widh and Gharamah assessed, applied, waived, and collected.",
    available: true,
    category: "credit_quality",
    filters: ["from", "to"],
    columns: [
      { key: "noteReference", label: "Note", kind: "text" },
      { key: "settlementReference", label: "Settlement", kind: "text" },
      { key: "postedAt", label: "Posted", kind: "date" },
      { key: "tawidhApplied", label: "Ta'widh applied", kind: "money" },
      { key: "gharamahApplied", label: "Gharamah applied", kind: "money" },
      { key: "tawidhInvestor", label: "Ta'widh to investors", kind: "money" },
      { key: "tawidhPlatform", label: "Ta'widh platform", kind: "money" },
      { key: "gharamahCharity", label: "Gharamah (charity)", kind: "money" },
      { key: "waivedTotal", label: "Waived", kind: "money" },
      { key: "excessOwed", label: "Excess owed", kind: "money" },
      { key: "excessPaid", label: "Excess paid", kind: "money" },
    ],
  },
  {
    key: "default_recovery",
    title: "Default & recovery",
    description: "Defaulted notes, recoveries, and days since default.",
    available: true,
    category: "credit_quality",
    filters: ["asOf"],
    columns: [
      { key: "noteReference", label: "Note", kind: "text" },
      { key: "issuerName", label: "Issuer", kind: "text" },
      { key: "defaultDate", label: "Default date", kind: "date" },
      { key: "defaultReason", label: "Reason", kind: "text" },
      { key: "fundedPrincipal", label: "Funded principal", kind: "money" },
      { key: "recoveredPrincipal", label: "Recovered principal", kind: "money" },
      { key: "recoveredProfit", label: "Recovered profit", kind: "money" },
      { key: "outstandingTotal", label: "Outstanding", kind: "money" },
      { key: "recoveryPercent", label: "Recovery %", kind: "percent" },
      { key: "daysSinceDefault", label: "Days since default", kind: "number" },
    ],
  },
  {
    key: "origination",
    title: "Origination & funding",
    description:
      "Notes published or closed in the period, with application funnel summaries for submissions.",
    available: true,
    category: "origination",
    filters: ["from", "to"],
    columns: [
      { key: "noteReference", label: "Note", kind: "text" },
      { key: "issuerName", label: "Issuer", kind: "text" },
      { key: "listingStatus", label: "Listing status", kind: "text" },
      { key: "fundingStatus", label: "Funding status", kind: "text" },
      { key: "targetAmount", label: "Target", kind: "money" },
      { key: "fundedAmount", label: "Funded", kind: "money" },
      { key: "fundedPercent", label: "Funded %", kind: "percent" },
      { key: "publishedAt", label: "Published", kind: "date" },
      { key: "fundingClosedAt", label: "Funding closed", kind: "date" },
      { key: "daysOpen", label: "Days open", kind: "number" },
      { key: "outcome", label: "Outcome", kind: "text" },
    ],
  },
  {
    key: "portfolio_composition",
    title: "Portfolio composition",
    description:
      "Open book by start month, issuer, paymaster, or sector, with outstanding and default exposure.",
    available: true,
    category: "origination",
    filters: ["asOf"],
    breakdownOptions: [...REPORT_BREAKDOWNS],
    columns: [
      { key: "groupLabel", label: "Group", kind: "text" },
      { key: "noteCount", label: "Notes", kind: "number" },
      { key: "fundedPrincipal", label: "Funded principal", kind: "money" },
      { key: "outstandingTotal", label: "Outstanding", kind: "money" },
      { key: "shareOfBookPercent", label: "Share of book", kind: "percent" },
      { key: "pastDueCount", label: "Past due notes", kind: "number" },
      { key: "pastDueAmount", label: "Past due", kind: "money" },
      { key: "defaultedCount", label: "Defaulted notes", kind: "number" },
      { key: "defaultedAmount", label: "Defaulted", kind: "money" },
      { key: "defaultExposurePercent", label: "Default exposure", kind: "percent" },
    ],
  },
  {
    key: "investor_book",
    title: "Investor book",
    description:
      "Current holdings plus cash movement and realised returns for the selected period.",
    available: true,
    category: "investors_treasury",
    filters: ["from", "to"],
    columns: [
      { key: "investorName", label: "Investor", kind: "text" },
      { key: "investorCategory", label: "SC category", kind: "text" },
      { key: "availableCash", label: "Available cash", kind: "money" },
      { key: "reservedAmount", label: "Reserved", kind: "money" },
      { key: "confirmedAmount", label: "Confirmed invested", kind: "money" },
      { key: "activeNoteCount", label: "Active notes", kind: "number" },
      { key: "expectedNetRatePercent", label: "Expected net rate", kind: "percent" },
      { key: "realisedPrincipal", label: "Realised principal", kind: "money" },
      { key: "realisedProfitNet", label: "Realised net profit", kind: "money" },
      { key: "realisedTawidh", label: "Realised Ta'widh", kind: "money" },
    ],
  },
  {
    key: "trust_revenue",
    title: "Trust & revenue",
    description:
      "Trust-bucket opening, movement, and closing, with posted platform revenue explained separately.",
    available: true,
    category: "investors_treasury",
    filters: ["from", "to"],
    columns: [
      { key: "bucket", label: "Bucket", kind: "text" },
      { key: "opening", label: "Opening", kind: "money" },
      { key: "credits", label: "Credits", kind: "money" },
      { key: "debits", label: "Debits", kind: "money" },
      { key: "closing", label: "Closing", kind: "money" },
    ],
  },
  {
    key: "comrep",
    title: "ComRep",
    description: "SC ComRep submissions will appear here.",
    available: false,
    category: "regulatory",
    filters: [],
    columns: [],
  },
];

export interface ReportCategoryGroup {
  key: ReportCategoryKey;
  label: string;
  description: string;
  reports: ReportDefinition[];
}

export function groupReportsByCategory(
  reports: ReportDefinition[] = REPORT_REGISTRY
): ReportCategoryGroup[] {
  return REPORT_CATEGORIES.map((category) => ({
    ...category,
    reports: reports.filter((report) => report.category === category.key),
  }));
}

export function isReportKey(value: string): value is ReportKey {
  return (REPORT_KEYS as readonly string[]).includes(value);
}

export function isReportCategoryKey(value: string): value is ReportCategoryKey {
  return REPORT_CATEGORIES.some((category) => category.key === value);
}

export function isReportBreakdown(value: string): value is ReportBreakdown {
  return (REPORT_BREAKDOWNS as readonly string[]).includes(value);
}

export function reportDefinition(key: ReportKey): ReportDefinition | undefined {
  return REPORT_REGISTRY.find((report) => report.key === key);
}

export interface ReportQuery {
  asOf?: string;
  from?: string;
  to?: string;
  groupBy?: ReportBreakdown;
  format?: ReportFormat;
}

export interface ReportSummaryRow {
  label: string;
  count?: number;
  amount?: number;
  percent?: number;
}

export interface PortfolioAtRiskMetric {
  count: number;
  amount: number;
  percent: number;
}

/** SC indicative PAR90 cap as a percent of book outstanding. */
export const SC_PAR90_LIMIT_PERCENT = 5;

export type Par90LimitStatus = "inside" | "over";

export function par90LimitStatus(percent: number): Par90LimitStatus {
  return percent <= SC_PAR90_LIMIT_PERCENT ? "inside" : "over";
}

export interface PortfolioAtRiskSummary {
  asOf: string;
  bookCount: number;
  bookOutstanding: number;
  pastDue: PortfolioAtRiskMetric;
  par30: PortfolioAtRiskMetric;
  par60: PortfolioAtRiskMetric;
  par90: PortfolioAtRiskMetric;
  defaulted: PortfolioAtRiskMetric;
  exclusive: {
    current: PortfolioAtRiskMetric;
    dpd1To30: PortfolioAtRiskMetric;
    dpd31To60: PortfolioAtRiskMetric;
    dpd61To90: PortfolioAtRiskMetric;
    dpd90Plus: PortfolioAtRiskMetric;
  };
}

export interface ReportResult {
  key: ReportKey;
  title: string;
  asOf?: string | null;
  from?: string | null;
  to?: string | null;
  generatedAt: string;
  columns: ReportColumn[];
  rows: Array<Record<string, string | number | boolean | null>>;
  summaries: ReportSummaryRow[];
  portfolioAtRisk?: PortfolioAtRiskSummary;
  emptyReason?: string | null;
}

export interface ReportCatalogResponse {
  reports: ReportDefinition[];
}
