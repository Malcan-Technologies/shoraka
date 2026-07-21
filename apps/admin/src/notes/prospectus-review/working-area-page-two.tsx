"use client";

import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import {
  MARKETPLACE_MIN_COMMIT_MYR,
  PROSPECTUS_COMPANY_SIZE_VALUES,
  PROSPECTUS_CONFIDENCE_GRADING_VALUES,
  PROSPECTUS_DEED_OF_ASSIGNMENT_VALUES,
  PROSPECTUS_PAYMASTER_RATING_VALUES,
  normalizeProspectusCompanySize,
  normalizeProspectusConfidenceGrading,
  normalizeProspectusDeedOfAssignment,
  normalizeProspectusPaymasterRating,
  resolveSoukscoreRiskRatingPresentation,
  type ProspectusReviewStoredContent,
} from "@cashsouk/types";
import { INVOICE_WORK_FIELD_LABELS } from "@/notes/prospectus-review/labels";
import type { CoreTermRow } from "@/notes/prospectus-review/core-terms";
import type { FinancialMetricTableModel } from "@/notes/prospectus-review/financial-metric-table";
import { ProspectusFinancialComparisonWorkingTable } from "@/notes/prospectus-review/financial-comparison-working-table";
import {
  ProspectusEditableTextField,
  ProspectusEditableTextarea,
  ProspectusInfoGrid,
  ProspectusOptionSelect,
  ProspectusPageHeader,
  ProspectusReadOnlyField,
  ProspectusSectionShell,
} from "@/notes/prospectus-review/field-presentation";

const RISK_SCALE_VERSION = "2026.07.21.soukscore-scale.v1";

const ISSUER_EDITABLE_LABEL = "Company Size";
const INVOICE_EDITABLE_LABELS = new Set([
  "Deed of Assignment (DOA)",
  "Paymaster Rating",
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
  dirty: boolean;
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
  updateDraft: (
    updater: (prev: ProspectusReviewStoredContent) => ProspectusReviewStoredContent
  ) => void;
  completionLabel?: string;
};

export function WorkingAreaPageTwo({
  draft,
  locked,
  canManage,
  dirty,
  catalogues,
  issuerProfileRows,
  invoicePaymasterRows,
  financialComparisonTable,
  financialComparisonOverrides,
  financialComparisonOpsWarning,
  noteRiskRating,
  updateDraft,
  completionLabel,
}: WorkingAreaPageTwoProps) {
  const disabled = locked || !canManage;
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
  const risk = resolveSoukscoreRiskRatingPresentation(noteRiskRating);

  const filteredIssuerRows = issuerProfileRows.filter((r) => r.label !== ISSUER_EDITABLE_LABEL);
  const filteredInvoiceRows = invoicePaymasterRows.filter(
    (r) => !INVOICE_EDITABLE_LABELS.has(r.label)
  );

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
    <div className="space-y-8" data-prospectus-working-page="2">
      <ProspectusPageHeader
        title="Page 2 / Issuer & Credit Review"
        subtitle="Issuer profile, invoice facts, and credit assessment"
        completionLabel={completionLabel}
        dirty={dirty}
      />

      <div data-prospectus-issuer-profile>
      <ProspectusSectionShell title="Issuer Profile">
        <ProspectusInfoGrid>
          {filteredIssuerRows.map((row) => (
            <ProspectusReadOnlyField key={row.label} label={row.label} value={row.value} />
          ))}
          <ProspectusOptionSelect
            label="Company Size"
            value={companySize}
            disabled={disabled}
            required
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
      <ProspectusSectionShell title="Invoice & Paymaster Information">
        <ProspectusInfoGrid>
          {filteredInvoiceRows.map((row) => (
            <ProspectusReadOnlyField key={row.label} label={row.label} value={row.value} />
          ))}
          <ProspectusOptionSelect
            label="Deed of Assignment (DOA)"
            value={deedOfAssignment}
            disabled={disabled}
            required
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
          <ProspectusOptionSelect
            label="Paymaster Rating"
            value={paymasterRating}
            disabled={disabled}
            required
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
      <ProspectusSectionShell title="Paymaster Track Record" optional>
        <ProspectusInfoGrid columns={2}>
          {PAYMASTER_TRACK_FIELDS.map(([key, label, unit]) => (
            <ProspectusEditableTextField
              key={key}
              label={unit ? `${label} (${unit})` : label}
              optional
              type="number"
              disabled={disabled}
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

      <div data-prospectus-financial-comparison>
      <ProspectusSectionShell title="3-Year Financial Comparison (MYR mil.)">
        {financialComparisonOpsWarning ? (
          <div
            role="status"
            data-testid="financial-comparison-ops-warning"
            className="mb-3 flex gap-2 rounded-lg border border-amber-500/40 bg-amber-50 p-3 text-sm text-foreground dark:bg-amber-950/30"
          >
            <ExclamationTriangleIcon
              className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
              aria-hidden
            />
            <div className="min-w-0 space-y-1">
              <p className="font-semibold">{financialComparisonOpsWarning.title}</p>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                {financialComparisonOpsWarning.description}
              </p>
            </div>
          </div>
        ) : null}
        <ProspectusFinancialComparisonWorkingTable
          table={financialComparisonTable}
          overrides={financialComparisonOverrides}
          disabled={disabled}
          onChange={updateFinancialOverride}
        />
      </ProspectusSectionShell>
      </div>

      <ProspectusSectionShell title="Credit Insights">
        <ProspectusInfoGrid columns={2}>
          {(
            [
              ["creditScoreOptionKey", "creditScore", "Credit Score"],
              ["paymentBehaviourOptionKey", "paymentBehaviour", "Payment Behaviour"],
              ["creditUtilisationOptionKey", "creditUtilisation", "Credit Utilisation"],
              ["litigationCheckOptionKey", "litigationCheck", "Litigation Check"],
              ["ccrisStatusOptionKey", "ccrisStatus", "CCRIS Status"],
            ] as const
          ).map(([field, catalogueKey, label]) => (
            <ProspectusOptionSelect
              key={field}
              label={label}
              required
              disabled={disabled}
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
      </ProspectusSectionShell>

      <div data-prospectus-about-invoice>
      <ProspectusSectionShell title="About the Invoice / Work Performed">
        <div className="space-y-4">
          {(draft.page2.aboutInvoice?.items ?? []).map((item, idx) => (
            <ProspectusEditableTextarea
              key={item.id}
              label={
                item.sourceType === "SYSTEM_SUGGESTION"
                  ? `${INVOICE_WORK_FIELD_LABELS[item.id] ?? "Invoice statement"} (suggested)`
                  : (INVOICE_WORK_FIELD_LABELS[item.id] ?? "Invoice statement")
              }
              required
              disabled={disabled}
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

      <ProspectusSectionShell title="Risk & CTA Information">
        <div className="space-y-6">
          <div>
            <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Risk Rating
            </h4>
            <ProspectusInfoGrid>
              <ProspectusReadOnlyField label="Risk Rating Grade" value={risk.grade} />
              <ProspectusReadOnlyField label="Risk Label" value={risk.label} />
              <ProspectusReadOnlyField
                label="Risk Explanation"
                value={risk.explanation}
                className="sm:col-span-2 lg:col-span-3"
              />
              <ProspectusReadOnlyField label="Scale Version" value={RISK_SCALE_VERSION} />
            </ProspectusInfoGrid>
          </div>
          <div data-prospectus-investment-cta>
            <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Investment CTA
            </h4>
            <ProspectusInfoGrid>
              <ProspectusReadOnlyField
                label="CTA Heading"
                value="INVEST WITH CONFIDENCE"
              />
              <ProspectusReadOnlyField
                label="Button State"
                value="Disabled in Prospectus preview"
              />
              <ProspectusReadOnlyField label="Link" value="None" />
              <ProspectusReadOnlyField
                label="Minimum Investment"
                value={formatCurrency(MARKETPLACE_MIN_COMMIT_MYR)}
              />
            </ProspectusInfoGrid>
          </div>
        </div>
      </ProspectusSectionShell>
    </div>
  );
}
