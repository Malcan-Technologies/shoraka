"use client";

import * as React from "react";
import {
  ChartBarIcon,
  InformationCircleIcon,
  LightBulbIcon,
  PresentationChartLineIcon,
  ScaleIcon,
} from "@heroicons/react/24/outline";
import type { ProspectusReviewStoredContent } from "@cashsouk/types";
import type { CoreTermRow } from "@/notes/prospectus-review/core-terms";
import type { FinancialMetricTableModel } from "@/notes/prospectus-review/financial-metric-table";
import type { PageThreeManualYears } from "@/notes/prospectus-review/page-three-coverage";
import { ProspectusBalanceSheetWorkingTable } from "@/notes/prospectus-review/balance-sheet-working-table";
import { ProspectusCoverageWorkingTable } from "@/notes/prospectus-review/coverage-working-table";
import { ProspectusIncomeStatementWorkingTable } from "@/notes/prospectus-review/income-statement-working-table";
import {
  countMissingForTab,
  type ProspectusCompletionOptions,
} from "@/notes/prospectus-review/completion";
import {
  ProspectusInfoGrid,
  ProspectusOptionSelect,
  ProspectusPageHeader,
  ProspectusReadOnlyField,
  ProspectusReusedField,
  ProspectusSectionShell,
} from "@/notes/prospectus-review/field-presentation";
import { ProspectusInternalTabs } from "@/notes/prospectus-review/working-area-tabs";
import type { PageThreeTabId } from "@/notes/prospectus-review/working-area-placeholders";
import { SELECT_PLACEHOLDERS } from "@/notes/prospectus-review/working-area-placeholders";

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
  updateManualField: (year: string, field: string, value: string) => void;
  updateDraft: (
    updater: (prev: ProspectusReviewStoredContent) => ProspectusReviewStoredContent
  ) => void;
  completionLabel?: string;
  completionOptions?: ProspectusCompletionOptions;
  activeTab?: PageThreeTabId;
  onTabChange?: (tab: PageThreeTabId) => void;
};

function overviewSource(label: string): string | undefined {
  if (label === "Paymaster Grading" || label === "Confidence Grading") {
    return "From Page 2 — Issuer & Paymaster";
  }
  if (label === "Company Size") {
    return "From Page 2 — Issuer Profile";
  }
  if (label === "Risk Grade") {
    return "From Invoice Offer";
  }
  return undefined;
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
  updateManualField,
  updateDraft,
  completionLabel,
  completionOptions,
  activeTab: controlledTab,
  onTabChange,
}: WorkingAreaPageThreeProps) {
  const disabled = locked || !canManage;
  const [internalTab, setInternalTab] = React.useState<PageThreeTabId>("overview");
  const tab = controlledTab ?? internalTab;
  const setTab = (next: PageThreeTabId) => {
    onTabChange?.(next);
    if (controlledTab == null) setInternalTab(next);
  };

  const incomeMissing = countMissingForTab(draft, "income", completionOptions);
  const balanceMissing = countMissingForTab(draft, "balance", completionOptions);
  const coverageMissing = countMissingForTab(draft, "coverage", completionOptions);
  const takeawaysMissing = countMissingForTab(draft, "takeaways", completionOptions);

  return (
    <div className="space-y-6" data-prospectus-working-page="3">
      <ProspectusPageHeader
        title="Page 3 — Financial Review"
        completionLabel={completionLabel}
      />

      <ProspectusInternalTabs
        value={tab}
        onChange={setTab}
        aria-label="Page 3 sections"
        tabs={[
          { id: "overview", label: "Overview", missingCount: 0 },
          { id: "income", label: "Income Statement", missingCount: incomeMissing },
          { id: "balance", label: "Balance Sheet", missingCount: balanceMissing },
          {
            id: "coverage",
            label: "Coverage & Efficiency",
            missingCount: coverageMissing,
          },
          {
            id: "takeaways",
            label: "Investor Takeaways",
            missingCount: takeawaysMissing,
          },
        ]}
      />

      {tab === "overview" ? (
        <div role="tabpanel">
          <ProspectusSectionShell title="Overview" icon={InformationCircleIcon}>
            <ProspectusInfoGrid>
              {overviewRows.map((row) => {
                const source = overviewSource(row.label);
                if (source) {
                  return (
                    <ProspectusReusedField
                      key={row.label}
                      label={row.label}
                      value={row.value}
                      source={source}
                    />
                  );
                }
                return (
                  <ProspectusReadOnlyField
                    key={row.label}
                    label={row.label}
                    value={row.value}
                  />
                );
              })}
            </ProspectusInfoGrid>
          </ProspectusSectionShell>
        </div>
      ) : null}

      {tab === "income" ? (
        <div role="tabpanel" data-prospectus-income-statement>
          <ProspectusSectionShell title="Income Statement" icon={ChartBarIcon} missingCount={incomeMissing}>
            <ProspectusIncomeStatementWorkingTable
              table={incomeStatementTable}
              years={years}
              manualYears={manualYears ?? {}}
              disabled={disabled}
              onChange={updateManualField}
            />
          </ProspectusSectionShell>
        </div>
      ) : null}

      {tab === "balance" ? (
        <div role="tabpanel" data-prospectus-balance-sheet>
          <ProspectusSectionShell title="Balance Sheet" icon={ScaleIcon} missingCount={balanceMissing}>
            <ProspectusBalanceSheetWorkingTable
              table={balanceSheetTable}
              years={years}
              manualYears={manualYears ?? {}}
              disabled={disabled}
              onChange={updateManualField}
            />
          </ProspectusSectionShell>
        </div>
      ) : null}

      {tab === "coverage" ? (
        <div role="tabpanel" data-prospectus-coverage>
          <ProspectusSectionShell
            title="Coverage & Efficiency"
            icon={PresentationChartLineIcon}
            missingCount={coverageMissing}
          >
            <ProspectusCoverageWorkingTable
              table={coverageTable}
              years={years}
              manualYears={manualYears ?? {}}
              disabled={disabled}
              onChange={updateManualField}
            />
          </ProspectusSectionShell>
        </div>
      ) : null}

      {tab === "takeaways" ? (
        <div role="tabpanel">
          <ProspectusSectionShell
            title="Investor Takeaways"
            icon={LightBulbIcon}
            missingCount={takeawaysMissing}
          >
            <div className="space-y-4">
              {TAKEAWAY_FIELDS.map(([catalogueKey, field, label]) => (
                <ProspectusOptionSelect
                  key={field}
                  label={label}
                  required
                  disabled={disabled}
                  incomplete={!draft.page3.investorTakeaways[field]}
                  placeholder={SELECT_PLACEHOLDERS.takeaway}
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
            </div>
          </ProspectusSectionShell>
        </div>
      ) : null}
    </div>
  );
}
