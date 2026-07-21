"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ProspectusReviewStoredContent } from "@cashsouk/types";
import type { CoreTermRow } from "@/notes/prospectus-review/core-terms";
import type { FinancialMetricTableModel } from "@/notes/prospectus-review/financial-metric-table";
import type { PageThreeManualYears } from "@/notes/prospectus-review/page-three-coverage";
import { ProspectusBalanceSheetWorkingTable } from "@/notes/prospectus-review/balance-sheet-working-table";
import { ProspectusCoverageWorkingTable } from "@/notes/prospectus-review/coverage-working-table";
import { ProspectusIncomeStatementWorkingTable } from "@/notes/prospectus-review/income-statement-working-table";
import {
  ProspectusInfoGrid,
  ProspectusOptionSelect,
  ProspectusPageHeader,
  ProspectusReusedField,
  ProspectusSectionShell,
} from "@/notes/prospectus-review/field-presentation";

type FinancialTab = "income" | "balance" | "coverage";

const TAKEAWAY_FIELDS = [
  ["revenue_profitability", "revenueProfitabilityOptionKey", "Revenue & Profitability"],
  ["liquidity", "liquidityOptionKey", "Liquidity"],
  ["leverage", "leverageOptionKey", "Leverage"],
  ["debt_servicing_capacity", "debtServicingCapacityOptionKey", "Debt Servicing Capacity"],
  ["receivables_collection", "receivablesCollectionOptionKey", "Receivables Collection"],
  ["overall_financial_profile", "overallFinancialProfileOptionKey", "Overall Financial Profile"],
] as const;

export type WorkingAreaPageThreeCatalogues = {
  takeaways: Record<string, Array<{ key: string; label: string }>>;
};

export type WorkingAreaPageThreeProps = {
  draft: ProspectusReviewStoredContent;
  overviewRows: CoreTermRow[];
  incomeStatementTable: FinancialMetricTableModel;
  balanceSheetTable: FinancialMetricTableModel;
  coverageTable: FinancialMetricTableModel;
  years: readonly string[];
  manualYears: PageThreeManualYears | undefined;
  catalogues: WorkingAreaPageThreeCatalogues;
  locked: boolean;
  canManage: boolean;
  dirty: boolean;
  updateManualField: (year: string, field: string, value: string) => void;
  updateDraft: (
    updater: (prev: ProspectusReviewStoredContent) => ProspectusReviewStoredContent
  ) => void;
  completionLabel?: string;
};

function overviewSource(label: string): string {
  if (label === "Paymaster Grading" || label === "Confidence Grading") {
    return "From Page 2 Invoice & Paymaster";
  }
  if (label === "Sector") {
    return "From Page 2 Issuer Profile";
  }
  if (label === "Risk Rating") {
    return "From Invoice Offer";
  }
  return "From note snapshot";
}

export function WorkingAreaPageThree({
  draft,
  overviewRows,
  incomeStatementTable,
  balanceSheetTable,
  coverageTable,
  years,
  manualYears,
  catalogues,
  locked,
  canManage,
  dirty,
  updateManualField,
  updateDraft,
  completionLabel,
}: WorkingAreaPageThreeProps) {
  const disabled = locked || !canManage;
  const [financialTab, setFinancialTab] = React.useState<FinancialTab>("income");

  const tabLabels: Array<{ id: FinancialTab; label: string }> = [
    { id: "income", label: "Income Statement" },
    { id: "balance", label: "Balance Sheet" },
    { id: "coverage", label: "Coverage & Efficiency" },
  ];

  return (
    <div className="space-y-8" data-prospectus-working-page="3">
      <ProspectusPageHeader
        title="Page 3 / Financial Review"
        subtitle="Financial tables and investor takeaways"
        completionLabel={completionLabel}
        dirty={dirty}
      />

      <ProspectusSectionShell title="Financing & Risk Details">
        <ProspectusInfoGrid>
          {overviewRows.map((row) => (
            <ProspectusReusedField
              key={row.label}
              label={row.label}
              value={row.value}
              source={overviewSource(row.label)}
            />
          ))}
        </ProspectusInfoGrid>
      </ProspectusSectionShell>

      <ProspectusSectionShell title="Financial Summary">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {tabLabels.map((tab) => (
              <Button
                key={tab.id}
                type="button"
                size="sm"
                variant={financialTab === tab.id ? "secondary" : "outline"}
                className={cn(
                  "h-9",
                  financialTab === tab.id && "font-semibold"
                )}
                aria-pressed={financialTab === tab.id}
                onClick={() => setFinancialTab(tab.id)}
              >
                {tab.label}
              </Button>
            ))}
          </div>

          {financialTab === "income" ? (
            <div data-prospectus-income-statement>
              <ProspectusIncomeStatementWorkingTable
                table={incomeStatementTable}
                years={years}
                manualYears={manualYears ?? {}}
                disabled={disabled}
                onChange={updateManualField}
              />
            </div>
          ) : null}

          {financialTab === "balance" ? (
            <div data-prospectus-balance-sheet>
              <ProspectusBalanceSheetWorkingTable
                table={balanceSheetTable}
                years={years}
                manualYears={manualYears ?? {}}
                disabled={disabled}
                onChange={updateManualField}
              />
            </div>
          ) : null}

          {financialTab === "coverage" ? (
            <div data-prospectus-coverage>
              <ProspectusCoverageWorkingTable
                table={coverageTable}
                years={years}
                manualYears={manualYears ?? {}}
                disabled={disabled}
                onChange={updateManualField}
              />
            </div>
          ) : null}
        </div>
      </ProspectusSectionShell>

      <ProspectusSectionShell title="Investor Takeaways">
        <ProspectusInfoGrid columns={2}>
          {TAKEAWAY_FIELDS.map(([catalogueKey, field, label]) => (
            <ProspectusOptionSelect
              key={field}
              label={label}
              required
              disabled={disabled}
              value={draft.page3.investorTakeaways[field]}
              options={catalogues.takeaways[catalogueKey] ?? []}
              onChange={(value) =>
                updateDraft((prev) => ({
                  ...prev,
                  page3: {
                    ...prev.page3,
                    investorTakeaways: {
                      ...prev.page3.investorTakeaways,
                      [field]: value,
                    },
                  },
                }))
              }
            />
          ))}
        </ProspectusInfoGrid>
      </ProspectusSectionShell>
    </div>
  );
}
