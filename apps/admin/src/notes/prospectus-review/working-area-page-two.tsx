"use client";

import * as React from "react";
import {
  BanknotesIcon,
  BuildingOffice2Icon,
  ChartBarIcon,
  ClipboardDocumentCheckIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  TableCellsIcon,
} from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import {
  MARKETPLACE_MIN_COMMIT_MYR,
  PROSPECTUS_COMPANY_SIZE_VALUES,
  PROSPECTUS_CONFIDENCE_GRADING_VALUES,
  PROSPECTUS_DEED_OF_ASSIGNMENT_VALUES,
  PROSPECTUS_PAYMASTER_RATING_VALUES,
  CASHSCOUK_RISK_GRADE_LETTER_COLOR,
  MARC_SME_BANDS,
  normalizeProspectusCompanySize,
  normalizeProspectusConfidenceGrading,
  normalizeProspectusDeedOfAssignment,
  normalizeProspectusPaymasterRating,
  resolveMarcNoteRiskPresentation,
  type MarcAssessmentSnapshot,
  type ProspectusReviewStoredContent,
} from "@cashsouk/types";
import { INVOICE_WORK_FIELD_LABELS } from "@/notes/prospectus-review/labels";
import type { CoreTermRow } from "@/notes/prospectus-review/core-terms";
import type { FinancialMetricTableModel } from "@/notes/prospectus-review/financial-metric-table";
import { ProspectusFinancialComparisonWorkingTable } from "@/notes/prospectus-review/financial-comparison-working-table";
import { ProspectusMissingFinancialYearWarning } from "@/notes/prospectus-review/missing-financial-year-warning";
import {
  countMissingForTab,
  type ProspectusCompletionOptions,
} from "@/notes/prospectus-review/completion";
import { ProspectusMarcAssessmentSummary } from "@/notes/prospectus-review/marc-assessment-summary";
import {
  ProspectusEditableTextField,
  ProspectusEditableTextarea,
  ProspectusInfoGrid,
  ProspectusOptionSelect,
  ProspectusPageHeader,
  ProspectusReadOnlyField,
  ProspectusSectionShell,
} from "@/notes/prospectus-review/field-presentation";
import { ProspectusInternalTabs } from "@/notes/prospectus-review/working-area-tabs";
import type { PageTwoTabId } from "@/notes/prospectus-review/working-area-placeholders";
import {
  INVOICE_STATEMENT_PLACEHOLDERS,
  PAYMASTER_TRACK_PLACEHOLDERS,
  SELECT_PLACEHOLDERS,
} from "@/notes/prospectus-review/working-area-placeholders";

const ISSUER_EDITABLE_LABEL = "Company Size";
const INVOICE_FACTS_EXCLUDED_LABELS = new Set([
  "Deed of Assignment (DOA)",
  "Paymaster Rating",
  "Paymaster Grading",
  "Confidence Grading",
]);

const PAYMASTER_TRACK_FIELDS = [
  ["totalInvoicesPaid", "Total Invoices Paid", ""] as const,
  ["totalAmountPaid", "Total Amount Paid", "RM"] as const,
  ["successfulRepaymentPercent", "Successful Repayment", "%"] as const,
  ["onTimePaymentPercent", "On-Time Payment", "%"] as const,
  ["averagePaymentPeriodDays", "Average Payment Period", "days"] as const,
];

export type WorkingAreaPageTwoCatalogues = {
  creditInsights: Record<string, Array<{ key: string; label: string }>>;
};

export type WorkingAreaPageTwoProps = {
  draft: ProspectusReviewStoredContent;
  locked: boolean;
  canManage: boolean;
  catalogues: WorkingAreaPageTwoCatalogues;
  issuerProfileRows: CoreTermRow[];
  invoicePaymasterRows: CoreTermRow[];
  financialComparisonTable: FinancialMetricTableModel;
  financialComparisonOverrides:
    | Record<
        string,
        {
          netDebtEquity?: string | number | null;
          interestCoverage?: string | number | null;
          dscr?: string | number | null;
          receivablesDays?: string | number | null;
        }
      >
    | null
    | undefined;
  financialComparisonOpsWarning: { title: string; description: string } | null;
  noteRiskRating: unknown;
  marcAssessment?: MarcAssessmentSnapshot | null;
  issuerOrganizationId?: string | null;
  marcAssessmentLoading?: boolean;
  updateDraft: (
    updater: (prev: ProspectusReviewStoredContent) => ProspectusReviewStoredContent
  ) => void;
  completionLabel?: string;
  completionOptions?: ProspectusCompletionOptions;
  activeTab?: PageTwoTabId;
  onTabChange?: (tab: PageTwoTabId) => void;
};

export function WorkingAreaPageTwo({
  draft,
  locked,
  canManage,
  catalogues,
  issuerProfileRows,
  invoicePaymasterRows,
  financialComparisonTable,
  financialComparisonOverrides,
  financialComparisonOpsWarning,
  noteRiskRating,
  marcAssessment = null,
  issuerOrganizationId = null,
  marcAssessmentLoading = false,
  updateDraft,
  completionLabel,
  completionOptions,
  activeTab: controlledTab,
  onTabChange,
}: WorkingAreaPageTwoProps) {
  const disabled = locked || !canManage;
  const [internalTab, setInternalTab] = React.useState<PageTwoTabId>("issuer_paymaster");
  const tab = controlledTab ?? internalTab;
  const setTab = (next: PageTwoTabId) => {
    onTabChange?.(next);
    if (controlledTab == null) setInternalTab(next);
  };

  const companySize = normalizeProspectusCompanySize(draft.page2.issuerProfile?.companySize);
  const deedOfAssignment = normalizeProspectusDeedOfAssignment(
    draft.page2.invoicePaymaster?.deedOfAssignment
  );
  const paymasterRating = normalizeProspectusPaymasterRating(
    draft.page2.invoicePaymaster?.paymasterRating
  );
  const confidenceGrading = normalizeProspectusConfidenceGrading(
    draft.page2.invoicePaymaster?.confidenceGrading
  );
  const risk = resolveMarcNoteRiskPresentation(noteRiskRating);

  const filteredIssuerRows = issuerProfileRows.filter((r) => r.label !== ISSUER_EDITABLE_LABEL);
  const filteredInvoiceRows = invoicePaymasterRows.filter(
    (r) => !INVOICE_FACTS_EXCLUDED_LABELS.has(r.label)
  );

  const issuerMissing = countMissingForTab(draft, "issuer_paymaster", completionOptions);
  const financialMissing = countMissingForTab(draft, "financial", completionOptions);
  const creditMissing = countMissingForTab(draft, "credit_invoice", completionOptions);
  const invoiceFactsMissing = deedOfAssignment ? 0 : 1;
  const paymasterGradingMissing =
    (paymasterRating ? 0 : 1) + (confidenceGrading ? 0 : 1);
  const creditInsightsMissing =
    (draft.page2.creditInsights.litigationCheckOptionKey ? 0 : 1) +
    (draft.page2.creditInsights.ccrisStatusOptionKey ? 0 : 1) +
    (completionOptions?.hasMarcAssessment === false ? 1 : 0);

  const updateFinancialOverride = (fyeKey: string, field: string, value: string) => {
    updateDraft((prev) => ({
      ...prev,
      page2: {
        ...prev.page2,
        financialComparison: {
          ...prev.page2.financialComparison,
          overrides: {
            ...prev.page2.financialComparison?.overrides,
            [fyeKey]: {
              ...prev.page2.financialComparison?.overrides?.[fyeKey],
              [field]: value === "" ? null : value,
            },
          },
        },
      },
    }));
  };

  return (
    <div className="space-y-6" data-prospectus-working-page="2">
      <ProspectusPageHeader
        title="Page 2 — Issuer & Credit Review"
        completionLabel={completionLabel}
      />

      <ProspectusInternalTabs
        value={tab}
        onChange={setTab}
        aria-label="Page 2 sections"
        tabs={[
          {
            id: "issuer_paymaster",
            label: "Issuer & Paymaster",
            missingCount: issuerMissing,
          },
          {
            id: "financial",
            label: "Financial Comparison",
            missingCount: financialMissing,
          },
          {
            id: "credit_invoice",
            label: "Credit & Invoice",
            missingCount: creditMissing,
          },
          { id: "risk", label: "Risk Information", missingCount: 0 },
        ]}
      />

      {tab === "issuer_paymaster" ? (
        <div className="space-y-6" role="tabpanel">
          <div data-prospectus-issuer-profile>
            <ProspectusSectionShell title="Issuer Profile" icon={BuildingOffice2Icon} missingCount={companySize ? 0 : 1}>
              <ProspectusInfoGrid>
                {filteredIssuerRows.map((row) => (
                  <ProspectusReadOnlyField key={row.label} label={row.label} value={row.value} />
                ))}
                <ProspectusOptionSelect
                  label="Company Size"
                  value={companySize}
                  disabled={disabled}
                  required
                  incomplete={!companySize}
                  placeholder={SELECT_PLACEHOLDERS.companySize}
                  options={PROSPECTUS_COMPANY_SIZE_VALUES.map((size) => ({
                    key: size,
                    label: size,
                  }))}
                  onChange={(value) =>
                    updateDraft((prev) => ({
                      ...prev,
                      page2: {
                        ...prev.page2,
                        issuerProfile: {
                          ...prev.page2.issuerProfile,
                          companySize: normalizeProspectusCompanySize(value),
                        },
                      },
                    }))
                  }
                />
              </ProspectusInfoGrid>
            </ProspectusSectionShell>
          </div>

          <div data-prospectus-invoice-paymaster>
            <ProspectusSectionShell
              title="Invoice & Paymaster"
              icon={DocumentTextIcon}
              missingCount={invoiceFactsMissing}
            >
              <ProspectusInfoGrid>
                {filteredInvoiceRows.map((row) => (
                  <ProspectusReadOnlyField key={row.label} label={row.label} value={row.value} />
                ))}
                <ProspectusOptionSelect
                  label="Deed of Assignment"
                  value={deedOfAssignment}
                  disabled={disabled}
                  required
                  incomplete={!deedOfAssignment}
                  placeholder={SELECT_PLACEHOLDERS.deedOfAssignment}
                  options={PROSPECTUS_DEED_OF_ASSIGNMENT_VALUES.map((value) => ({
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
                          deedOfAssignment: normalizeProspectusDeedOfAssignment(value),
                        },
                      },
                    }))
                  }
                />
              </ProspectusInfoGrid>
            </ProspectusSectionShell>
          </div>

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

          <div data-prospectus-paymaster-track-record>
            <ProspectusSectionShell title="Paymaster Track Record" icon={ChartBarIcon} optional>
              <ProspectusInfoGrid columns={2}>
                {PAYMASTER_TRACK_FIELDS.map(([key, label, unit]) => (
                  <ProspectusEditableTextField
                    key={key}
                    label={unit ? `${label} (${unit})` : label}
                    optional
                    type="number"
                    disabled={disabled}
                    placeholder={PAYMASTER_TRACK_PLACEHOLDERS[key]}
                    value={
                      draft.page2.paymasterTrackRecord?.[key] == null
                        ? ""
                        : String(draft.page2.paymasterTrackRecord[key])
                    }
                    onChange={(value) =>
                      updateDraft((prev) => ({
                        ...prev,
                        page2: {
                          ...prev.page2,
                          paymasterTrackRecord: {
                            ...prev.page2.paymasterTrackRecord,
                            [key]:
                              value === ""
                                ? null
                                : key === "totalInvoicesPaid"
                                  ? Number(value)
                                  : value,
                          },
                        },
                      }))
                    }
                  />
                ))}
              </ProspectusInfoGrid>
            </ProspectusSectionShell>
          </div>
        </div>
      ) : null}

      {tab === "financial" ? (
        <div role="tabpanel" data-prospectus-financial-comparison>
          <ProspectusSectionShell
            title="3-Year Financial Comparison (MYR mil.)"
            icon={TableCellsIcon}
            missingCount={financialMissing}
          >
            {financialComparisonOpsWarning ? (
              <ProspectusMissingFinancialYearWarning
                title={financialComparisonOpsWarning.title}
                description={financialComparisonOpsWarning.description}
              />
            ) : null}
            <ProspectusFinancialComparisonWorkingTable
              table={financialComparisonTable}
              overrides={financialComparisonOverrides}
              disabled={disabled}
              onChange={updateFinancialOverride}
            />
          </ProspectusSectionShell>
        </div>
      ) : null}

      {tab === "credit_invoice" ? (
        <div className="space-y-6" role="tabpanel">
          <ProspectusSectionShell title="Credit Insights" icon={ClipboardDocumentCheckIcon} missingCount={creditInsightsMissing}>
            <div className="space-y-6">
              <ProspectusMarcAssessmentSummary
                assessment={marcAssessment}
                issuerOrganizationId={issuerOrganizationId}
                loading={marcAssessmentLoading}
              />
              <ProspectusInfoGrid columns={2}>
                {(
                  [
                    ["litigationCheckOptionKey", "litigationCheck", "Litigation Check"],
                    ["ccrisStatusOptionKey", "ccrisStatus", "CCRIS Status"],
                  ] as const
                ).map(([field, catalogueKey, label]) => (
                  <ProspectusOptionSelect
                    key={field}
                    label={label}
                    required
                    disabled={disabled}
                    incomplete={!draft.page2.creditInsights[field]}
                    placeholder={SELECT_PLACEHOLDERS[catalogueKey]}
                    value={draft.page2.creditInsights[field]}
                    options={catalogues.creditInsights[catalogueKey] ?? []}
                    onChange={(value) =>
                      updateDraft((prev) => ({
                        ...prev,
                        page2: {
                          ...prev.page2,
                          creditInsights: {
                            ...prev.page2.creditInsights,
                            [field]: value,
                          },
                        },
                      }))
                    }
                  />
                ))}
              </ProspectusInfoGrid>
            </div>
          </ProspectusSectionShell>

          <div data-prospectus-about-invoice>
            <ProspectusSectionShell title="About the Invoice / Work Performed" icon={DocumentTextIcon}>
              <div className="space-y-4">
                {(draft.page2.aboutInvoice?.items ?? []).map((item, idx) => (
                  <ProspectusEditableTextarea
                    key={item.id}
                    label={INVOICE_WORK_FIELD_LABELS[item.id] ?? "Invoice statement"}
                    required
                    disabled={disabled}
                    incomplete={!item.text?.trim()}
                    placeholder={
                      INVOICE_STATEMENT_PLACEHOLDERS[item.id] ??
                      "Enter the approved invoice statement"
                    }
                    value={item.text}
                    onChange={(value) =>
                      updateDraft((prev) => {
                        const items = [...(prev.page2.aboutInvoice?.items ?? [])];
                        items[idx] = {
                          ...items[idx]!,
                          text: value,
                          sourceType: "OFFICER_ENTERED",
                        };
                        return {
                          ...prev,
                          page2: {
                            ...prev.page2,
                            aboutInvoice: { items },
                          },
                        };
                      })
                    }
                  />
                ))}
              </div>
            </ProspectusSectionShell>
          </div>
        </div>
      ) : null}

      {tab === "risk" ? (
        <div className="space-y-6" role="tabpanel">
          <ProspectusSectionShell title="Risk Rating Scale" icon={ShieldCheckIcon}>
            <div className="space-y-3" data-prospectus-risk-rating-scale>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[48rem] text-left text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-3 py-2 font-semibold">Grade</th>
                      <th className="px-3 py-2 font-semibold">Risk Level</th>
                      <th className="px-3 py-2 font-semibold">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MARC_SME_BANDS.map((band) => (
                      <tr key={band.key} className="border-b last:border-0">
                        <td className="px-3 py-2 font-semibold tabular-nums">
                          <span
                            className="inline-flex min-w-[5.5rem] items-center justify-center rounded-md px-2 py-1 text-xs font-extrabold"
                            style={{
                              backgroundColor: band.color,
                              color: CASHSCOUK_RISK_GRADE_LETTER_COLOR,
                            }}
                            data-grade-color={band.color}
                            data-grade-letter-color={CASHSCOUK_RISK_GRADE_LETTER_COLOR}
                          >
                            {band.rangeLabel}
                          </span>
                        </td>
                        <td className="px-3 py-2">{band.label}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {band.groupedExplanation}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!risk.isAvailable ? (
                <p className="text-sm text-muted-foreground">
                  Risk rating has not been assigned.
                </p>
              ) : null}
            </div>
          </ProspectusSectionShell>

          <div data-prospectus-investment-cta>
            <ProspectusSectionShell title="CTA Information" icon={BanknotesIcon}>
              <ProspectusInfoGrid>
                <ProspectusReadOnlyField
                  label="CTA Heading"
                  value="Invest with Confidence"
                />
                <ProspectusReadOnlyField
                  label="CTA Description"
                  value="Diversify your portfolio and earn attractive return with short-term, Shariah-compliant investment on CashSouk."
                />
                <ProspectusReadOnlyField
                  label="Minimum Investment"
                  value={formatCurrency(MARKETPLACE_MIN_COMMIT_MYR)}
                />
              </ProspectusInfoGrid>
            </ProspectusSectionShell>
          </div>
        </div>
      ) : null}
    </div>
  );
}
