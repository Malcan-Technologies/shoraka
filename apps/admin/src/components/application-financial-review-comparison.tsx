"use client";

/**
 * SECTION: Financial tab resubmit comparison (issuer-submitted figures + directors)
 * WHY: Mirrors financial review layout read-only; CTOS live fetch is not in snapshots.
 * INPUT: before/after app slices, path matcher, submitted dates
 * OUTPUT: ReviewFieldBlocks with ComparisonFieldRow and director side-by-side lists
 * WHERE USED: FinancialSection comparison mode
 */

import * as React from "react";
import { formatCurrency, formatNumber } from "@cashsouk/config";
import {
  FINANCIAL_FIELD_LABELS,
  computeColumnMetrics,
  financialFormToBsPl,
  type FinancialStatementsInput,
} from "@cashsouk/types";
import { ReviewFieldBlock } from "@/components/application-review/review-field-block";
import { ComparisonFieldRow } from "@/components/application-review/comparison-field-row";
import { reviewEmptyStateClass } from "@/components/application-review/review-section-styles";
import {
  parseFinancialStatements,
  extractDirectorShareholders,
  type DirectorShareholderRow,
} from "@/components/application-financial-review-content";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  applicationTableHeaderBgClass,
  applicationTableHeaderClass,
  applicationTableRowClass,
  applicationTableCellClass,
} from "@/components/application-review/application-table-styles";

const COMPUTED_FIELD_LABELS: Record<string, string> = {
  totass: "Total Assets",
  totlib: "Total Liability",
  networth: "Net Worth",
  turnover_growth: "Turnover Growth",
  profit_margin: "Profit Margin",
  return_of_equity: "Return of Equity",
  currat: "Current Ratio",
  workcap: "Working Capital",
};

function toNum(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

function financialRecordToInput(fs: Record<string, unknown>): FinancialStatementsInput {
  return {
    bsfatot: toNum(fs.bsfatot),
    othass: toNum(fs.othass),
    bscatot: toNum(fs.bscatot),
    bsclbank: toNum(fs.bsclbank),
    curlib: toNum(fs.curlib),
    bsslltd: toNum(fs.bsslltd),
    bsclstd: toNum(fs.bsclstd),
    bsqpuc: toNum(fs.bsqpuc),
    turnover: toNum(fs.turnover),
    plnpat: toNum(fs.plnpat),
  };
}

function formatIssuerFinancialCell(rowId: string, fs: Record<string, unknown> | null): string {
  if (!fs || Object.keys(fs).length === 0) return "—";
  const input = financialRecordToInput(fs);
  const { bs, pl } = financialFormToBsPl(input);
  const computed = computeColumnMetrics(bs, pl, null);

  switch (rowId) {
    case "pldd":
      return fs.pldd != null && fs.pldd !== "" ? String(fs.pldd) : "—";
    case "bsdd":
      return fs.bsdd != null && fs.bsdd !== "" ? String(fs.bsdd) : "—";
    case "bsfatot":
      return formatCurrency(toNum(fs.bsfatot), { decimals: 0 });
    case "othass":
      return formatCurrency(toNum(fs.othass), { decimals: 0 });
    case "bscatot":
      return formatCurrency(toNum(fs.bscatot), { decimals: 0 });
    case "bsclbank":
      return formatCurrency(toNum(fs.bsclbank), { decimals: 0 });
    case "totass":
      return formatCurrency(computed.totass, { decimals: 0 });
    case "curlib":
      return formatCurrency(toNum(fs.curlib), { decimals: 0 });
    case "bsslltd":
      return formatCurrency(toNum(fs.bsslltd), { decimals: 0 });
    case "bsclstd":
      return formatCurrency(toNum(fs.bsclstd), { decimals: 0 });
    case "totlib":
      return formatCurrency(computed.totlib, { decimals: 0 });
    case "networth":
      return formatCurrency(computed.networth, { decimals: 0 });
    case "bsqpuc":
      return formatCurrency(toNum(fs.bsqpuc), { decimals: 0 });
    case "turnover":
      return formatCurrency(toNum(fs.turnover), { decimals: 0 });
    case "plnpbt":
      return formatCurrency(toNum(fs.plnpbt), { decimals: 0 });
    case "plnpat":
      return formatCurrency(toNum(fs.plnpat), { decimals: 0 });
    case "plnetdiv":
      return formatCurrency(toNum(fs.plnetdiv), { decimals: 0 });
    case "plyear":
      return formatCurrency(toNum(fs.plyear), { decimals: 0 });
    case "turnover_growth":
      return computed.turnover_growth == null ? "—" : formatNumber(computed.turnover_growth * 100, 2) + "%";
    case "profit_margin":
      return computed.profit_margin == null ? "—" : formatNumber(computed.profit_margin * 100, 2) + "%";
    case "return_of_equity":
      return computed.return_of_equity == null ? "—" : formatNumber(computed.return_of_equity * 100, 2) + "%";
    case "currat":
      return computed.currat == null ? "—" : formatNumber(computed.currat, 2);
    case "workcap":
      return formatCurrency(computed.workcap, { decimals: 0 });
    default:
      return "—";
  }
}

const ROW_LABELS: { id: string; label: string }[] = [
  { id: "pldd", label: FINANCIAL_FIELD_LABELS.pldd },
  { id: "bsdd", label: FINANCIAL_FIELD_LABELS.bsdd },
  { id: "bsfatot", label: FINANCIAL_FIELD_LABELS.bsfatot },
  { id: "othass", label: FINANCIAL_FIELD_LABELS.othass },
  { id: "bscatot", label: FINANCIAL_FIELD_LABELS.bscatot },
  { id: "bsclbank", label: FINANCIAL_FIELD_LABELS.bsclbank },
  { id: "totass", label: COMPUTED_FIELD_LABELS.totass },
  { id: "curlib", label: FINANCIAL_FIELD_LABELS.curlib },
  { id: "bsslltd", label: FINANCIAL_FIELD_LABELS.bsslltd },
  { id: "bsclstd", label: FINANCIAL_FIELD_LABELS.bsclstd },
  { id: "totlib", label: COMPUTED_FIELD_LABELS.totlib },
  { id: "networth", label: COMPUTED_FIELD_LABELS.networth },
  { id: "bsqpuc", label: FINANCIAL_FIELD_LABELS.bsqpuc },
  { id: "turnover", label: FINANCIAL_FIELD_LABELS.turnover },
  { id: "plnpbt", label: FINANCIAL_FIELD_LABELS.plnpbt },
  { id: "plnpat", label: FINANCIAL_FIELD_LABELS.plnpat },
  { id: "plnetdiv", label: FINANCIAL_FIELD_LABELS.plnetdiv },
  { id: "plyear", label: FINANCIAL_FIELD_LABELS.plyear },
  { id: "turnover_growth", label: COMPUTED_FIELD_LABELS.turnover_growth },
  { id: "profit_margin", label: COMPUTED_FIELD_LABELS.profit_margin },
  { id: "return_of_equity", label: COMPUTED_FIELD_LABELS.return_of_equity },
  { id: "currat", label: COMPUTED_FIELD_LABELS.currat },
  { id: "workcap", label: COMPUTED_FIELD_LABELS.workcap },
];

function directorSummary(r: DirectorShareholderRow): string {
  return [r.role, r.name, r.ownership ?? "", r.verificationStatus ?? "—"].filter(Boolean).join(" · ");
}

export function ApplicationFinancialReviewComparison({
  beforeApp,
  afterApp,
  isPathChanged,
}: {
  beforeApp: {
    financial_statements?: unknown;
    issuer_organization?: {
      corporate_entities?: unknown;
      director_kyc_status?: unknown;
      director_aml_status?: unknown;
    } | null;
  };
  afterApp: typeof beforeApp;
  isPathChanged: (path: string) => boolean;
}) {
  console.log("ApplicationFinancialReviewComparison mount");
  const beforeFs = React.useMemo(
    () => parseFinancialStatements(beforeApp.financial_statements),
    [beforeApp.financial_statements]
  );
  const afterFs = React.useMemo(
    () => parseFinancialStatements(afterApp.financial_statements),
    [afterApp.financial_statements]
  );
  const beforeDir = React.useMemo(
    () => extractDirectorShareholders(beforeApp.issuer_organization),
    [beforeApp.issuer_organization]
  );
  const afterDir = React.useMemo(
    () => extractDirectorShareholders(afterApp.issuer_organization),
    [afterApp.issuer_organization]
  );

  const maxLen = Math.max(beforeDir.length, afterDir.length);

  return (
    <>
      <ReviewFieldBlock title="Issuer financial submission (comparison)">
        <p className="text-xs text-muted-foreground mb-3">
          CTOS columns are not stored in revision snapshots. Use the main Financial tab for audited-year
          CTOS data.
        </p>
        <div className="space-y-2">
          {ROW_LABELS.map((row) => {
            const path = `financial_statements.${row.id}`;
            const pathInput = `financial_statements.input.${row.id}`;
            const changed =
              isPathChanged("financial_statements") ||
              isPathChanged(path) ||
              isPathChanged(pathInput);
            const b = formatIssuerFinancialCell(row.id, beforeFs);
            const a = formatIssuerFinancialCell(row.id, afterFs);
            return (
              <ComparisonFieldRow
                key={row.id}
                label={row.label}
                before={b}
                after={a}
                changed={changed}
              />
            );
          })}
        </div>
      </ReviewFieldBlock>

      <ReviewFieldBlock title="Director & Shareholders (snapshot)">
        {maxLen === 0 ? (
          <p className={reviewEmptyStateClass}>No director or shareholder data in these snapshots.</p>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <Table className="text-[15px]">
              <TableHeader className={applicationTableHeaderBgClass}>
                <TableRow className="hover:bg-transparent border-b border-border">
                  <TableHead className={applicationTableHeaderClass}>Role / name</TableHead>
                  <TableHead className={applicationTableHeaderClass}>Before</TableHead>
                  <TableHead className={applicationTableHeaderClass}>After</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: maxLen }).map((_, i) => {
                  const br = beforeDir[i];
                  const ar = afterDir[i];
                  const changed =
                    isPathChanged("issuer_organization") ||
                    (br && isPathChanged(`issuer_organization.corporate_entities.directors[${i}]`)) ||
                    (ar && isPathChanged(`issuer_organization.corporate_entities.directors[${i}]`));
                  return (
                    <TableRow key={i} className={applicationTableRowClass}>
                      <TableCell className={`${applicationTableCellClass} font-medium`}>
                        {`Row ${i + 1}`}
                        {changed ? (
                          <span className="ml-2 text-xs text-accent font-normal">Changed</span>
                        ) : null}
                      </TableCell>
                      <TableCell className={applicationTableCellClass}>
                        {br ? directorSummary(br) : "—"}
                      </TableCell>
                      <TableCell className={applicationTableCellClass}>
                        {ar ? directorSummary(ar) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </ReviewFieldBlock>
    </>
  );
}
