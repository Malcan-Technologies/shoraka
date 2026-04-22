/**
 * SECTION: Dev-only guarantor before/after payloads for resubmit comparison
 * WHY: Preview Business & Guarantor diff without real API field_changes
 * INPUT: Flip USE_MOCK_GUARANTOR_COMPARISON to true in this file (local only)
 * OUTPUT: business_details + field_changes entries merged in ResubmitComparisonModal
 * WHERE USED: apps/admin resubmit comparison modal
 */

import type { ReviewApplicationView } from "@/components/application-review/section-content";
import type { ResubmitFieldChangeItem } from "@/components/application-revision-diff-panel";

/** Set to true locally to overlay guarantor mock data on loaded snapshots. */
export const USE_MOCK_GUARANTOR_COMPARISON = false;

/**
 * full — first guarantor: every scalar differs; second: new company.
 * partial — first guarantor: only name differs; second: new company.
 */
export type MockGuarantorScenario = "full" | "partial";
export const MOCK_GUARANTOR_SCENARIO: MockGuarantorScenario = "full";

const MOCK_ABOUT = {
  what_does_company_do: "Wholesale food distribution (mock comparison data).",
  main_customers: "Hotels and cafés in Klang Valley.",
  single_customer_over_50_revenue: false,
};

const MOCK_WHY = {
  financing_for: "Invoice-backed working capital (mock).",
  how_funds_used: "Stock purchase and delivery fleet maintenance.",
  business_plan: "Expand cold-chain routes; mock text for layout.",
  risks_delay_repayment: "Seasonal demand dip; mock.",
  backup_plan: "Short-term trade credit line; mock.",
  raising_on_other_p2p: false,
  platform_name: "",
  amount_raised: null,
  same_invoice_used: null,
  accounting_software: "MockBooks",
  supporting_documents: [],
};

/** Before: one individual guarantor. */
const mockBusinessDetailsBefore: ReviewApplicationView["business_details"] = {
  about_your_business: MOCK_ABOUT,
  why_raising_funds: MOCK_WHY,
  declaration_confirmed: true,
  guarantors: [
    {
      guarantor_type: "individual",
      reference_id: "mock-ref-1",
      name: "Maria Garcia",
      ic_number: "850505105555",
      nationality: "MY",
      email: "maria@example.com",
    },
  ],
};

const mockBusinessDetailsAfterFull: ReviewApplicationView["business_details"] = {
  about_your_business: MOCK_ABOUT,
  why_raising_funds: MOCK_WHY,
  declaration_confirmed: true,
  guarantors: [
    {
      guarantor_type: "individual",
      reference_id: "mock-ref-1",
      name: "Siti Norhaliza",
      ic_number: "920315081234",
      email: "siti@example.com",
    },
    {
      guarantor_type: "company",
      reference_id: "mock-ref-2",
      business_name: "Apex Logistics Sdn Bhd",
      ssm_number: "202001012345",
      email: "ops@apex.example.com",
    },
  ],
};

/** Same as before for first guarantor except name (partial edit). */
const mockBusinessDetailsAfterPartial: ReviewApplicationView["business_details"] = {
  about_your_business: MOCK_ABOUT,
  why_raising_funds: MOCK_WHY,
  declaration_confirmed: true,
  guarantors: [
    {
      guarantor_type: "individual",
      reference_id: "mock-ref-1",
      name: "Maria Norhaliza",
      ic_number: "850505105555",
      nationality: "MY",
      email: "maria@example.com",
    },
    {
      guarantor_type: "company",
      reference_id: "mock-ref-2",
      business_name: "Apex Logistics Sdn Bhd",
      ssm_number: "202001012345",
      email: "ops@apex.example.com",
    },
  ],
};

const mockGuarantorFieldChangesFull: ResubmitFieldChangeItem[] = [
  {
    path: "business_details.guarantors[0].name",
    section_key: "business_details",
    section_label: "Business details",
    field_label: "Guarantor 1 — name",
    previous_value: "Maria Garcia",
    next_value: "Siti Norhaliza",
  },
  {
    path: "business_details.guarantors[0].ic_number",
    section_key: "business_details",
    section_label: "Business details",
    field_label: "Guarantor 1 — IC number",
    previous_value: "850505105555",
    next_value: "920315081234",
  },
  {
    path: "business_details.guarantors[0].email",
    section_key: "business_details",
    section_label: "Business details",
    field_label: "Guarantor 1 — email",
    previous_value: "maria@example.com",
    next_value: "siti@example.com",
  },
  {
    path: "business_details.guarantors[1]",
    section_key: "business_details",
    section_label: "Business details",
    field_label: "Guarantor 2 (new)",
    previous_value: "",
    next_value: "Apex Logistics Sdn Bhd",
  },
];

const mockGuarantorFieldChangesPartial: ResubmitFieldChangeItem[] = [
  {
    path: "business_details.guarantors[0].name",
    section_key: "business_details",
    section_label: "Business details",
    field_label: "Guarantor 1 — name",
    previous_value: "Maria Garcia",
    next_value: "Maria Norhaliza",
  },
  {
    path: "business_details.guarantors[1]",
    section_key: "business_details",
    section_label: "Business details",
    field_label: "Guarantor 2 (new)",
    previous_value: "",
    next_value: "Apex Logistics Sdn Bhd",
  },
];

export function getMockGuarantorBusinessDetailsAfter(): ReviewApplicationView["business_details"] {
  return MOCK_GUARANTOR_SCENARIO === "partial"
    ? mockBusinessDetailsAfterPartial
    : mockBusinessDetailsAfterFull;
}

export function getMockGuarantorFieldChanges(): ResubmitFieldChangeItem[] {
  return MOCK_GUARANTOR_SCENARIO === "partial"
    ? mockGuarantorFieldChangesPartial
    : mockGuarantorFieldChangesFull;
}

export function applyMockGuarantorComparisonApps(
  beforeApp: ReviewApplicationView,
  afterApp: ReviewApplicationView
): { beforeApp: ReviewApplicationView; afterApp: ReviewApplicationView } {
  console.log(
    "applyMockGuarantorComparisonApps: overlaying mock guarantors, scenario:",
    MOCK_GUARANTOR_SCENARIO
  );
  return {
    beforeApp: { ...beforeApp, business_details: mockBusinessDetailsBefore },
    afterApp: { ...afterApp, business_details: getMockGuarantorBusinessDetailsAfter() },
  };
}
