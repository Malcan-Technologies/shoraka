"use client";

import * as React from "react";
import {
  ChartBarIcon,
  ClipboardDocumentCheckIcon,
  InformationCircleIcon,
  LightBulbIcon,
  PresentationChartLineIcon,
  ScaleIcon,
} from "@heroicons/react/24/outline";
import {
  PROSPECTUS_CONFIDENCE_GRADING_VALUES,
  PROSPECTUS_PAYMASTER_RATING_VALUES,
  normalizeProspectusConfidenceGrading,
  normalizeProspectusPaymasterRating,
  type ProspectusReviewStoredContent,
} from "@cashsouk/types";
import type { CoreTermRow } from "@/notes/prospectus-review/core-terms";
import type { FinancialMetricTableModel } from "@/notes/prospectus-review/financial-metric-table";
import type { PageThreeManualYears } from "@/notes/prospectus-review/page-three-coverage";
import { ProspectusBalanceSheetWorkingTable } from "@/notes/prospectus-review/balance-sheet-working-table";
import { ProspectusCoverageWorkingTable } from "@/notes/prospectus-review/coverage-working-table";
import { ProspectusIncomeStatementWorkingTable } from "@/notes/prospectus-review/income-statement-working-table";
import { ProspectusMissingFinancialYearWarning } from "@/notes/prospectus-review/missing-financial-year-warning";
import {
  countMissingForTab,
  type ProspectusCompletionOptions,
} from "@/notes/prospectus-review/completion";
import {
  ProspectusInfoGrid,
  ProspectusOptionSelect,
  ProspectusPageHeader,
  ProspectusReadOnlyField,
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
  /** Display year keys aligned 1:1 with table yearHeaders (includes placeholders). */
  years: readonly string[];
  manualYears: PageThreeManualYears | undefined;
  catalogues: WorkingAreaPageThreeCatalogues;
  locked: boolean;
  canManage: boolean;
  /** Same non-blocking ops warning as Page 2 financial comparison. */
  financialComparisonOpsWarning?: { title: string; description: string } | null;
  updateManualField: (year: string, field: string, value: string) => void;
  updateDraft: (
    updater: (prev: ProspectusReviewStoredContent) => ProspectusReviewStoredContent
  ) => void;
  completionLabel?: string;
  completionOptions?: ProspectusCompletionOptions;
  activeTab?: PageThreeTabId;
  onTabChange?: (tab: PageThreeTabId) => void;
};

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
  financialComparisonOpsWarning = null,
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

  const paymasterRating = normalizeProspectusPaymasterRating(
    draft.page2.invoicePaymaster?.paymasterRating
  );
  const confidenceGrading = normalizeProspectusConfidenceGrading(
    draft.page2.invoicePaymaster?.confidenceGrading
  );
  const paymasterGradingMissing =
    (paymasterRating ? 0 : 1) + (confidenceGrading ? 0 : 1);
  const overviewFacts = overviewRows.filter(
    (row) => row.label !== "Paymaster Grading" && row.label !== "Confidence Grading"
  );

  const incomeMissing = countMissingForTab(draft, "income", completionOptions);
  const balanceMissing = countMissingForTab(draft, "balance", completionOptions);
  const coverageMissing = countMissingForTab(draft, "coverage", completionOptions);
  const takeawaysMissing = countMissingForTab(draft, "takeaways", completionOptions);
  const overviewMissing = countMissingForTab(draft, "overview", completionOptions);
  const showFinancialOpsWarning =
    financialComparisonOpsWarning != null &&
    (tab === "income" || tab === "balance" || tab === "coverage");

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
          { id: "overview", label: "Overview", missingCount: overviewMissing },
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

      {showFinancialOpsWarning && financialComparisonOpsWarning ? (
        <ProspectusMissingFinancialYearWarning
          title={financialComparisonOpsWarning.title}
          description={financialComparisonOpsWarning.description}
        />
      ) : null}

      <div data-prospectus-page-three-paymaster-grading>
        <ProspectusSectionShell
          title="Page 3 Paymaster Grading"
          icon={ClipboardDocumentCheckIcon}
          missingCount={paymasterGradingMissing}
        >
          <ProspectusInfoGrid columns={2}>
            <ProspectusOptionSelect
              label="Paymaster Grading"
              value={paymasterRating}
              disabled={disabled}
              required
              incomplete={!paymasterRating}
              placeholder={SELECT_PLACEHOLDERS.paymasterRating}
              options={PROSPECTUS_PAYMASTER_RATING_VALUES.map((value) => ({
                key: value,
                label: value,
              }))}
              onChange={(value) =>
                updateDraft((prev) => ({
                  ...prev,
                  page2: {
                    ...prev.page2,
                    invoicePaymaster: {
                      ...prev.page2.invoicePaymaster,
                      paymasterRating: normalizeProspectusPaymasterRating(value),
                    },
                  },
                }))
              }
            />
            <ProspectusOptionSelect
              label="Confidence Grading"
              value={confidenceGrading}
              disabled={disabled}
              required
              incomplete={!confidenceGrading}
              placeholder={SELECT_PLACEHOLDERS.confidenceGrading}
              options={PROSPECTUS_CONFIDENCE_GRADING_VALUES.map((value) => ({
                key: value,
                label: value,
              }))}
              onChange={(value) =>
                updateDraft((prev) => ({
                  ...prev,
                  page2: {
                    ...prev.page2,
                    invoicePaymaster: {
                      ...prev.page2.invoicePaymaster,
                      confidenceGrading: normalizeProspectusConfidenceGrading(value),
                    },
                  },
                }))
              }
            />
          </ProspectusInfoGrid>
        </ProspectusSectionShell>
      </div>

      {tab === "overview" ? (
        <div role="tabpanel">
          <ProspectusSectionShell title="Overview" icon={InformationCircleIcon}>
            <ProspectusInfoGrid>
              {overviewFacts.map((row) => (
                <ProspectusReadOnlyField
                  key={row.label}
                  label={row.label}
                  value={row.value}
                />
              ))}
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
