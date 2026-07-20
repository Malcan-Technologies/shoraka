/**
 * SECTION: Zod schemas for prospectus review draft/approve payloads
 */

import { z } from "zod";
import {
  normalizeProspectusCompanySize,
  normalizeProspectusConfidenceGrading,
  normalizeProspectusDeedOfAssignment,
  normalizeProspectusPaymasterRating,
  PROSPECTUS_HIGHLIGHT_KEYS,
} from "@cashsouk/types";
import { parseProspectusFinancialNumber } from "../prospectus/prospectus-financial-comparison-metrics";
import {
  PROSPECTUS_CREDIT_INSIGHT_OPTIONS,
  PROSPECTUS_DERIVED_FINANCIAL_FIELD_KEYS,
  PROSPECTUS_INVOICE_WORK_KEYS,
  PROSPECTUS_INVOICE_WORK_OPTION_CATALOGUE,
  PROSPECTUS_MANUAL_FINANCIAL_FIELD_KEYS,
  PROSPECTUS_TAKEAWAY_OPTION_CATALOGUE,
  findCatalogueOption,
} from "./prospectus-option-catalogues";

const nullableOptionKey = z.string().trim().min(1).nullable().optional();

const numericOrString = z.union([z.number(), z.string(), z.null()]).optional();

const HIGHLIGHT_TITLE_MAX = 160;
const HIGHLIGHT_DESCRIPTION_MAX = 800;

const manualYearSchema = z
  .object({
    grossProfit: numericOrString,
    ebitda: numericOrString,
    ebit: numericOrString,
    cashAndBank: numericOrString,
    tradeReceivables: numericOrString,
    totalEquity: numericOrString,
    quickRatio: numericOrString,
    operatingCashFlow: numericOrString,
    freeCashFlow: numericOrString,
    interestCoverage: numericOrString,
    dscr: numericOrString,
    debtEquity: numericOrString,
    returnOnAssets: numericOrString,
    receivablesDays: numericOrString,
    payablesDays: numericOrString,
    assetTurnover: numericOrString,
  })
  .strict();

export const prospectusReviewStoredContentSchema = z
  .object({
    page1: z
      .object({
        keyInvestorHighlights: z.array(
          z
            .object({
              key: z.string(),
              title: z.string().max(HIGHLIGHT_TITLE_MAX).optional().default(""),
              description: z.string().max(HIGHLIGHT_DESCRIPTION_MAX).optional().default(""),
              // Legacy catalogue fields accepted for parse only.
              optionKey: nullableOptionKey,
              isVisible: z.boolean().optional(),
            })
            .strict()
        ),
        // Legacy keys accepted for parse only; ignored for resolve/completion.
        paymentBasisOptionKey: nullableOptionKey,
        shariahPrincipleOptionKey: nullableOptionKey,
      })
      .strict(),
    page2: z
      .object({
        issuerProfile: z
          .object({
            companySize: z
              .enum(["Micro", "Small", "Medium", "Large"])
              .nullable()
              .optional(),
          })
          .strict()
          .optional(),
        invoicePaymaster: z
          .object({
            deedOfAssignment: z.enum(["Yes", "No"]).nullable().optional(),
            paymasterRating: z.enum(["PM1", "PM2", "PM3", "PM4"]).nullable().optional(),
            confidenceGrading: z.enum(["High", "Medium", "Low"]).nullable().optional(),
          })
          .strict()
          .optional(),
        paymasterTrackRecord: z
          .object({
            totalInvoicesPaid: z.number().finite().nullable().optional(),
            totalAmountPaid: numericOrString,
            successfulRepaymentPercent: numericOrString,
            onTimePaymentPercent: numericOrString,
            averagePaymentPeriodDays: numericOrString,
          })
          .strict()
          .optional(),
        financialComparison: z
          .object({
            overrides: z
              .record(
                z.string(),
                z
                  .object({
                    netDebtEquity: numericOrString,
                    interestCoverage: numericOrString,
                    dscr: numericOrString,
                    receivablesDays: numericOrString,
                  })
                  .strict()
              )
              .optional(),
          })
          .strict()
          .optional(),
        creditInsights: z
          .object({
            creditScoreOptionKey: nullableOptionKey,
            paymentBehaviourOptionKey: nullableOptionKey,
            creditUtilisationOptionKey: nullableOptionKey,
            litigationCheckOptionKey: nullableOptionKey,
            ccrisStatusOptionKey: nullableOptionKey,
          })
          .strict(),
        invoiceWorkStatements: z.array(
          z
            .object({
              key: z.string(),
              optionKey: nullableOptionKey,
              isVisible: z.boolean(),
            })
            .strict()
        ),
      })
      .strict(),
    page3: z
      .object({
        manualFinancialInputs: z
          .object({
            years: z.record(z.string(), manualYearSchema),
          })
          .strict()
          .optional(),
        investorTakeaways: z
          .object({
            revenueProfitabilityOptionKey: nullableOptionKey,
            liquidityOptionKey: nullableOptionKey,
            leverageOptionKey: nullableOptionKey,
            debtServicingCapacityOptionKey: nullableOptionKey,
            workingCapitalEfficiencyOptionKey: nullableOptionKey,
            overallFinancialProfileOptionKey: nullableOptionKey,
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

export const saveProspectusReviewDraftSchema = z.object({
  draftContent: prospectusReviewStoredContentSchema,
  /** Optimistic concurrency — ISO string of current updated_at */
  expectedUpdatedAt: z.string().datetime().optional(),
});

export type SaveProspectusReviewDraftInput = z.infer<typeof saveProspectusReviewDraftSchema>;

function isValidNumeric(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return true;
    return Number.isFinite(Number(trimmed.replace(/,/g, "")));
  }
  return false;
}

export type ProspectusReviewFieldError = { path: string; message: string };

/** Draft: shape + numeric safety only. */
export function validateDraftContent(
  content: z.infer<typeof prospectusReviewStoredContentSchema>
): ProspectusReviewFieldError[] {
  const errors: ProspectusReviewFieldError[] = [];

  for (const h of content.page1.keyInvestorHighlights) {
    if (!PROSPECTUS_HIGHLIGHT_KEYS.includes(h.key as (typeof PROSPECTUS_HIGHLIGHT_KEYS)[number])) {
      errors.push({ path: `page1.keyInvestorHighlights.${h.key}`, message: "Unknown highlight key" });
    }
    if (typeof h.title === "string" && h.title.length > HIGHLIGHT_TITLE_MAX) {
      errors.push({
        path: `page1.keyInvestorHighlights.${h.key}.title`,
        message: `Title must be at most ${HIGHLIGHT_TITLE_MAX} characters`,
      });
    }
    if (typeof h.description === "string" && h.description.length > HIGHLIGHT_DESCRIPTION_MAX) {
      errors.push({
        path: `page1.keyInvestorHighlights.${h.key}.description`,
        message: `Description must be at most ${HIGHLIGHT_DESCRIPTION_MAX} characters`,
      });
    }
  }

  const creditPairs: Array<[string, string | null | undefined]> = [
    ["creditScoreOptionKey", content.page2.creditInsights.creditScoreOptionKey],
    ["paymentBehaviourOptionKey", content.page2.creditInsights.paymentBehaviourOptionKey],
    ["creditUtilisationOptionKey", content.page2.creditInsights.creditUtilisationOptionKey],
    ["litigationCheckOptionKey", content.page2.creditInsights.litigationCheckOptionKey],
    ["ccrisStatusOptionKey", content.page2.creditInsights.ccrisStatusOptionKey],
  ];
  for (const [field, key] of creditPairs) {
    if (key && !findCatalogueOption(PROSPECTUS_CREDIT_INSIGHT_OPTIONS, key)) {
      errors.push({ path: `page2.creditInsights.${field}`, message: "Invalid option key" });
    }
  }

  for (const s of content.page2.invoiceWorkStatements) {
    if (!PROSPECTUS_INVOICE_WORK_KEYS.includes(s.key as (typeof PROSPECTUS_INVOICE_WORK_KEYS)[number])) {
      errors.push({ path: `page2.invoiceWorkStatements.${s.key}`, message: "Unknown statement key" });
    }
    if (s.optionKey) {
      const opts = PROSPECTUS_INVOICE_WORK_OPTION_CATALOGUE[s.key] ?? [];
      if (!findCatalogueOption(opts, s.optionKey)) {
        errors.push({
          path: `page2.invoiceWorkStatements.${s.key}.optionKey`,
          message: "Invalid option key",
        });
      }
    }
  }

  const takeawayPairs: Array<[string, string, string | null | undefined]> = [
    ["revenue_profitability", "revenueProfitabilityOptionKey", content.page3.investorTakeaways.revenueProfitabilityOptionKey],
    ["liquidity", "liquidityOptionKey", content.page3.investorTakeaways.liquidityOptionKey],
    ["leverage", "leverageOptionKey", content.page3.investorTakeaways.leverageOptionKey],
    ["debt_servicing_capacity", "debtServicingCapacityOptionKey", content.page3.investorTakeaways.debtServicingCapacityOptionKey],
    ["working_capital_efficiency", "workingCapitalEfficiencyOptionKey", content.page3.investorTakeaways.workingCapitalEfficiencyOptionKey],
    ["overall_financial_profile", "overallFinancialProfileOptionKey", content.page3.investorTakeaways.overallFinancialProfileOptionKey],
  ];
  for (const [catalogueKey, field, key] of takeawayPairs) {
    if (key && !findCatalogueOption(PROSPECTUS_TAKEAWAY_OPTION_CATALOGUE[catalogueKey] ?? [], key)) {
      errors.push({ path: `page3.investorTakeaways.${field}`, message: "Invalid option key" });
    }
  }

  const track = content.page2.paymasterTrackRecord;
  if (track) {
    if (track.totalInvoicesPaid != null && track.totalInvoicesPaid < 0) {
      errors.push({
        path: "page2.paymasterTrackRecord.totalInvoicesPaid",
        message: "Must be zero or positive",
      });
    }
    for (const field of [
      "totalAmountPaid",
      "successfulRepaymentPercent",
      "onTimePaymentPercent",
      "averagePaymentPeriodDays",
    ] as const) {
      const n = parseProspectusFinancialNumber(track[field]);
      if (n != null && n < 0) {
        errors.push({
          path: `page2.paymasterTrackRecord.${field}`,
          message: "Must be zero or positive",
        });
      }
    }
    for (const field of ["successfulRepaymentPercent", "onTimePaymentPercent"] as const) {
      const n = parseProspectusFinancialNumber(track[field]);
      if (n != null && n > 100) {
        errors.push({
          path: `page2.paymasterTrackRecord.${field}`,
          message: "Percentage must be between 0 and 100",
        });
      }
    }
  }

  const financialOverrides = content.page2.financialComparison?.overrides ?? {};
  for (const [yearKey, row] of Object.entries(financialOverrides)) {
    for (const field of ["netDebtEquity", "interestCoverage", "dscr"] as const) {
      const n = parseProspectusFinancialNumber(row[field]);
      if (n != null && n < 0) {
        errors.push({
          path: `page2.financialComparison.overrides.${yearKey}.${field}`,
          message: "Must be zero or positive",
        });
      }
    }
    const days = parseProspectusFinancialNumber(row.receivablesDays);
    if (days != null) {
      if (days < 0) {
        errors.push({
          path: `page2.financialComparison.overrides.${yearKey}.receivablesDays`,
          message: "Must be zero or positive",
        });
      } else if (!Number.isInteger(days)) {
        errors.push({
          path: `page2.financialComparison.overrides.${yearKey}.receivablesDays`,
          message: "Receivables Days must be a whole number",
        });
      }
    }
  }

  const years = content.page3.manualFinancialInputs?.years ?? {};
  for (const [year, row] of Object.entries(years)) {
    if (!/^\d{4}$/.test(year)) {
      errors.push({ path: `page3.manualFinancialInputs.years.${year}`, message: "Invalid year key" });
      continue;
    }
    const record = row as Record<string, unknown>;
    for (const forbidden of PROSPECTUS_DERIVED_FINANCIAL_FIELD_KEYS) {
      if (forbidden in record && record[forbidden] != null) {
        errors.push({
          path: `page3.manualFinancialInputs.years.${year}.${forbidden}`,
          message: "Derived field override is not allowed",
        });
      }
    }
    for (const field of PROSPECTUS_MANUAL_FINANCIAL_FIELD_KEYS) {
      if (!isValidNumeric(record[field])) {
        errors.push({
          path: `page3.manualFinancialInputs.years.${year}.${field}`,
          message: "Invalid numeric value",
        });
      }
    }
  }

  // Reject accidental identity / source blobs
  const serialized = JSON.stringify(content);
  for (const banned of [
    "registration_number",
    "companyName",
    "issuerName",
    "ctosFinancials",
    "unaudited_by_year",
    "application_financial_statements",
  ]) {
    if (serialized.includes(banned)) {
      errors.push({ path: "content", message: `Forbidden field reference: ${banned}` });
    }
  }

  return errors;
}

/** Approval: draft rules + required officer selections present (or Do not display). */
export function validateApprovalContent(
  content: z.infer<typeof prospectusReviewStoredContentSchema>
): ProspectusReviewFieldError[] {
  const errors = validateDraftContent(content);

  for (const key of PROSPECTUS_HIGHLIGHT_KEYS) {
    const hit = content.page1.keyInvestorHighlights.find((h) => h.key === key);
    const title = typeof hit?.title === "string" ? hit.title.trim() : "";
    const description = typeof hit?.description === "string" ? hit.description.trim() : "";
    // Shariah is forced to fixed copy on normalize/save; still require a row.
    if (key === "shariah") {
      if (!hit) {
        errors.push({
          path: `page1.keyInvestorHighlights.${key}`,
          message: "Shariah highlight is required",
        });
      }
      continue;
    }
    if (!title) {
      errors.push({
        path: `page1.keyInvestorHighlights.${key}.title`,
        message: "Highlight title is required",
      });
    }
    if (!description) {
      errors.push({
        path: `page1.keyInvestorHighlights.${key}.description`,
        message: "Highlight description is required",
      });
    }
  }
  for (const field of [
    "creditScoreOptionKey",
    "paymentBehaviourOptionKey",
    "creditUtilisationOptionKey",
    "litigationCheckOptionKey",
    "ccrisStatusOptionKey",
  ] as const) {
    if (!content.page2.creditInsights[field]) {
      errors.push({ path: `page2.creditInsights.${field}`, message: "Selection required" });
    }
  }

  for (const key of PROSPECTUS_INVOICE_WORK_KEYS) {
    const hit = content.page2.invoiceWorkStatements.find((s) => s.key === key);
    if (!hit?.optionKey && hit?.isVisible !== false) {
      errors.push({
        path: `page2.invoiceWorkStatements.${key}.optionKey`,
        message: "Selection required (or mark not visible)",
      });
    }
  }

  for (const field of [
    "revenueProfitabilityOptionKey",
    "liquidityOptionKey",
    "leverageOptionKey",
    "debtServicingCapacityOptionKey",
    "workingCapitalEfficiencyOptionKey",
    "overallFinancialProfileOptionKey",
  ] as const) {
    if (!content.page3.investorTakeaways[field]) {
      errors.push({ path: `page3.investorTakeaways.${field}`, message: "Selection required" });
    }
  }

  if (!normalizeProspectusCompanySize(content.page2.issuerProfile?.companySize)) {
    errors.push({
      path: "page2.issuerProfile.companySize",
      message: "Company Size is required before approving the Prospectus.",
    });
  }

  if (
    !normalizeProspectusDeedOfAssignment(content.page2.invoicePaymaster?.deedOfAssignment)
  ) {
    errors.push({
      path: "page2.invoicePaymaster.deedOfAssignment",
      message: "Deed of Assignment (DOA) is required before approving the Prospectus.",
    });
  }
  if (!normalizeProspectusPaymasterRating(content.page2.invoicePaymaster?.paymasterRating)) {
    errors.push({
      path: "page2.invoicePaymaster.paymasterRating",
      message: "Paymaster Rating is required before approving the Prospectus.",
    });
  }
  if (
    !normalizeProspectusConfidenceGrading(content.page2.invoicePaymaster?.confidenceGrading)
  ) {
    errors.push({
      path: "page2.invoicePaymaster.confidenceGrading",
      message: "Confidence Grading is required before approving the Prospectus.",
    });
  }

  return errors;
}
