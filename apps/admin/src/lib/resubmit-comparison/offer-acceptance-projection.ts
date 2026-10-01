/**
 * SECTION: Offer & acceptance tab resubmit comparison projection
 * WHY: Same stages render the merged Offer & acceptance comparison and decide its Diff badge.
 * INPUT: Before / after review apps built from revision snapshots
 * OUTPUT: Read-only data stages per merged backend section + has-changes flag
 * WHERE USED: OfferAcceptanceComparison, resubmit comparison modal badge
 *
 * Stage ids/titles mirror buildOfferAcceptanceStageModel. Workflow-only stages (issuer response,
 * acceptance documents, signing package, upfront facility fee, inherited acceptance) are omitted:
 * they show admin/issuer progress, not resubmitted issuer data. Only fields the live stage renders
 * become rows, so admin-only columns (status, paymaster, capacity, offer timestamps) never diff.
 */

import { isInvoiceOnlyFinancingStructure, SC_MONTHLY_CAMPAIGN } from "@cashsouk/types";
import {
  resolveOfferedFacility,
  resolveRequestedFacility,
} from "@cashsouk/config/src/offer-resolvers";
import type { ReviewApplicationView } from "@/components/application-review/section-content";
import {
  fileDocToComparisonFiles,
  formatFacilityFeeRate,
  formatFacilityFeeUpfront,
  formatOfferAcceptanceDate,
  formatOfferAcceptanceMoney,
  formatPositiveAmount,
  invoiceDetailString,
  invoiceDocumentFiles,
  invoiceFinancingAmountDisplay,
  invoiceFinancingRatioDisplay,
  invoiceFinancingTenureDisplay,
  invoiceMaturityDisplay,
  invoiceOfferedAmountDisplay,
  invoiceSubmittedCampaignSectorLabel,
  invoiceSubmittedCompanyCategoryLabel,
  invoiceSubmittedSustainabilityCategoryLabel,
  invoiceTabLabel,
  invoiceValueDisplay,
  offerAcceptanceTriBool,
} from "./offer-acceptance-format";
import {
  stagesHaveChanges,
  type ComparisonBlock,
  type ComparisonRow,
  type ComparisonStage,
} from "./projection-types";
import { formatReviewText } from "./shared-format";

export type OfferAcceptanceComparisonProjection = {
  /** Facility review / Facility reference / Customer review + facility Send offer. */
  contract_details: ComparisonStage[];
  /** Invoice review (or the new_contract invoice block) + invoice Send offer. */
  invoice_details: ComparisonStage[];
  /**
   * Display-only: invoice label shown beside per-invoice block titles, keyed by block id.
   * Not part of the Diff result.
   */
  blockAsides: Record<string, string>;
};

export type OfferAcceptanceComparisonStructure =
  | "new_contract"
  | "existing_contract"
  | "invoice_only";

/** Stage id for the new_contract Invoice card rendered below the live rail (live InvoiceSection). */
export const OFFER_ACCEPTANCE_COMPARISON_INVOICES_STAGE_ID = "invoices";

type Rec = Record<string, unknown> | null | undefined;

type ComparisonInvoice = NonNullable<ReviewApplicationView["invoices"]>[number] & {
  displayReference?: string | null;
};

/** Same structure normalisation as the live stage model (unknown → new_contract). */
export function resolveOfferAcceptanceComparisonStructure(
  app: Pick<ReviewApplicationView, "financing_structure">
): OfferAcceptanceComparisonStructure {
  if (isInvoiceOnlyFinancingStructure(app.financing_structure)) return "invoice_only";
  const type = (app.financing_structure as { structure_type?: string } | null | undefined)
    ?.structure_type;
  return type === "existing_contract" ? "existing_contract" : "new_contract";
}

function textRow(
  key: string,
  label: string,
  before: string | null,
  after: string | null,
  multiline?: boolean
): ComparisonRow {
  return { key, label, kind: "text", before, after, ...(multiline ? { multiline } : {}) };
}

function contractDetails(app: ReviewApplicationView): Rec {
  return app.contract?.contract_details as Rec;
}

function customerDetails(app: ReviewApplicationView): Rec {
  return app.contract?.customer_details as Rec;
}

function contractOfferDetails(app: ReviewApplicationView): Rec {
  return app.contract?.offer_details as Rec;
}

/** ContractReviewFields "Contract Details" (product-rule and approved-capacity rows excluded). */
function contractDetailsBlock(b: Rec, a: Rec): ComparisonBlock | null {
  if (!b && !a) return null;
  const pick = (cd: Rec, field: (cd: NonNullable<Rec>) => string): string | null =>
    cd ? field(cd) : null;
  return {
    id: "contract_details",
    title: "Contract Details",
    rows: [
      textRow(
        "title",
        "Contract Title",
        pick(b, (cd) => formatReviewText(cd.title)),
        pick(a, (cd) => formatReviewText(cd.title))
      ),
      textRow(
        "description",
        "Contract Description",
        pick(b, (cd) => formatReviewText(cd.description)),
        pick(a, (cd) => formatReviewText(cd.description)),
        true
      ),
      textRow(
        "number",
        "Contract Number",
        pick(b, (cd) => formatReviewText(cd.number)),
        pick(a, (cd) => formatReviewText(cd.number))
      ),
      textRow(
        "value",
        "Contract Value",
        pick(b, (cd) => formatOfferAcceptanceMoney(cd.value)),
        pick(a, (cd) => formatOfferAcceptanceMoney(cd.value))
      ),
      textRow(
        "financing",
        "Requested Financing Amount",
        pick(b, (cd) => formatOfferAcceptanceMoney(cd.financing)),
        pick(a, (cd) => formatOfferAcceptanceMoney(cd.financing))
      ),
      textRow(
        "start_date",
        "Contract Start Date",
        pick(b, (cd) => formatOfferAcceptanceDate(cd.start_date as string)),
        pick(a, (cd) => formatOfferAcceptanceDate(cd.start_date as string))
      ),
      textRow(
        "end_date",
        "Contract End Date",
        pick(b, (cd) => formatOfferAcceptanceDate(cd.end_date as string)),
        pick(a, (cd) => formatOfferAcceptanceDate(cd.end_date as string))
      ),
    ],
  };
}

/**
 * Customer Details as ContractReviewFields / CustomerReviewFields print them.
 * Large-private is the admin select shown only in Facility review (not reference / Customer review).
 */
function customerDetailsBlock(
  b: Rec,
  a: Rec,
  includeLargePrivate: boolean
): ComparisonBlock | null {
  if (!b && !a) return null;
  const text = (cust: Rec, key: string): string | null =>
    cust ? formatReviewText(cust[key]) : null;
  const rows: ComparisonRow[] = [
    textRow("name", "Customer Name", text(b, "name"), text(a, "name")),
    textRow("entity_type", "Customer Entity Type", text(b, "entity_type"), text(a, "entity_type")),
  ];
  if (includeLargePrivate) {
    rows.push({
      key: "is_large_private_company",
      label: "Is Customer a Large Private Company?",
      kind: "yesno",
      before: offerAcceptanceTriBool(b?.is_large_private_company),
      after: offerAcceptanceTriBool(a?.is_large_private_company),
    });
  }
  rows.push(
    textRow("ssm_number", "Customer SSM Number", text(b, "ssm_number"), text(a, "ssm_number")),
    textRow("country", "Customer Country", text(b, "country"), text(a, "country")),
    {
      key: "is_related_party",
      label: "Is Customer Related to Issuer?",
      kind: "yesno",
      before: offerAcceptanceTriBool(b?.is_related_party),
      after: offerAcceptanceTriBool(a?.is_related_party),
    }
  );
  return { id: "customer_details", title: "Customer Details", rows };
}

function evidenceBlock(b: Rec, a: Rec): ComparisonBlock {
  return {
    id: "evidence",
    title: "Evidence",
    rows: [
      {
        key: "contract_document",
        label: "Contract Document",
        kind: "files",
        before: fileDocToComparisonFiles(
          b?.document as Parameters<typeof fileDocToComparisonFiles>[0]
        ),
        after: fileDocToComparisonFiles(
          a?.document as Parameters<typeof fileDocToComparisonFiles>[0]
        ),
      },
    ],
  };
}

function facilityFieldBlocks(
  beforeApp: ReviewApplicationView,
  afterApp: ReviewApplicationView,
  includeLargePrivate: boolean
): ComparisonBlock[] {
  return [
    contractDetailsBlock(contractDetails(beforeApp), contractDetails(afterApp)),
    customerDetailsBlock(
      customerDetails(beforeApp),
      customerDetails(afterApp),
      includeLargePrivate
    ),
    evidenceBlock(contractDetails(beforeApp), contractDetails(afterApp)),
  ].filter((block): block is ComparisonBlock => block != null);
}

/** ContractSection "Offer to Issuer" — the four persisted facility offer fields. */
function facilityOfferBlock(
  beforeApp: ReviewApplicationView,
  afterApp: ReviewApplicationView
): ComparisonBlock {
  const bCd = contractDetails(beforeApp);
  const aCd = contractDetails(afterApp);
  const bOffer = contractOfferDetails(beforeApp);
  const aOffer = contractOfferDetails(afterApp);
  return {
    id: "offer_to_issuer",
    title: "Offer to Issuer",
    rows: [
      textRow(
        "requested_facility",
        "Requested Facility",
        formatPositiveAmount(resolveRequestedFacility(bCd)),
        formatPositiveAmount(resolveRequestedFacility(aCd))
      ),
      textRow(
        "offered_facility",
        "Offered Facility",
        formatPositiveAmount(resolveOfferedFacility(bOffer)),
        formatPositiveAmount(resolveOfferedFacility(aOffer))
      ),
      textRow(
        "facility_fee_rate_percent",
        "Facility fee rate",
        formatFacilityFeeRate(bOffer?.facility_fee_rate_percent),
        formatFacilityFeeRate(aOffer?.facility_fee_rate_percent)
      ),
      textRow(
        "facility_fee_upfront_collect_amount",
        "Collect upfront now",
        formatFacilityFeeUpfront(bOffer?.facility_fee_upfront_collect_amount),
        formatFacilityFeeUpfront(aOffer?.facility_fee_upfront_collect_amount)
      ),
    ],
  };
}

function projectContractStages(
  structure: OfferAcceptanceComparisonStructure,
  beforeApp: ReviewApplicationView,
  afterApp: ReviewApplicationView
): ComparisonStage[] {
  if (structure === "invoice_only") {
    const customer = customerDetailsBlock(
      customerDetails(beforeApp),
      customerDetails(afterApp),
      false
    );
    return [
      { id: "customer_review", title: "Customer review", blocks: customer ? [customer] : [] },
    ];
  }
  if (structure === "existing_contract") {
    return [
      {
        id: "facility_reference",
        title: "Facility",
        blocks: facilityFieldBlocks(beforeApp, afterApp, false),
      },
    ];
  }
  return [
    {
      id: "facility_review",
      title: "Facility review",
      blocks: facilityFieldBlocks(beforeApp, afterApp, true),
    },
    { id: "send_offer", title: "Send offer", blocks: [facilityOfferBlock(beforeApp, afterApp)] },
  ];
}

/** After-list order first, then invoices only present before (removed on resubmit). */
function pairInvoices(
  beforeApp: ReviewApplicationView,
  afterApp: ReviewApplicationView
): { id: string; before?: ComparisonInvoice; after?: ComparisonInvoice }[] {
  const before = (beforeApp.invoices ?? []) as ComparisonInvoice[];
  const after = (afterApp.invoices ?? []) as ComparisonInvoice[];
  const beforeById = new Map(before.map((inv) => [inv.id, inv] as const));
  const afterIds = new Set(after.map((inv) => inv.id));
  return [
    ...after.map((inv) => ({ id: inv.id, before: beforeById.get(inv.id), after: inv })),
    ...before
      .filter((inv) => !afterIds.has(inv.id))
      .map((inv) => ({ id: inv.id, before: inv, after: undefined })),
  ];
}

type InvoicePair = ReturnType<typeof pairInvoices>[number];

/** Invoice label for the block title aside (after side wins; removed invoices keep their before label). */
function invoicePairLabel(pair: InvoicePair): string {
  // pairInvoices always sets at least one side.
  return invoiceTabLabel((pair.after ?? pair.before)!);
}

function invoiceDetailsBlockId(pairId: string): string {
  return `invoice_details:${pairId}`;
}

function invoiceOfferBlockId(pairId: string): string {
  return `invoice_offer:${pairId}`;
}

/** InvoiceStackedFields rows, labels and order. */
function invoiceDetailsBlock(pair: {
  id: string;
  before?: ComparisonInvoice;
  after?: ComparisonInvoice;
}): ComparisonBlock {
  const { before: b, after: a } = pair;
  const text = (inv: ComparisonInvoice | undefined, field: (inv: ComparisonInvoice) => string) =>
    inv ? field(inv) : null;
  return {
    id: invoiceDetailsBlockId(pair.id),
    title: "Invoice details",
    rows: [
      textRow(
        "number",
        "Invoice number",
        text(b, (inv) => invoiceDetailString(inv, "number")),
        text(a, (inv) => invoiceDetailString(inv, "number"))
      ),
      textRow(
        "maturity_date",
        "Maturity date",
        text(b, invoiceMaturityDisplay),
        text(a, invoiceMaturityDisplay)
      ),
      textRow(
        "financing_tenure",
        "Financing tenure",
        text(b, invoiceFinancingTenureDisplay),
        text(a, invoiceFinancingTenureDisplay)
      ),
      textRow("value", "Invoice value", text(b, invoiceValueDisplay), text(a, invoiceValueDisplay)),
      textRow(
        "financing_ratio",
        "Financing ratio",
        text(b, invoiceFinancingRatioDisplay),
        text(a, invoiceFinancingRatioDisplay)
      ),
      textRow(
        "financing_amount",
        "Financing amount",
        text(b, invoiceFinancingAmountDisplay),
        text(a, invoiceFinancingAmountDisplay)
      ),
      textRow(
        "company_category",
        SC_MONTHLY_CAMPAIGN.companyCategory.label,
        text(b, invoiceSubmittedCompanyCategoryLabel),
        text(a, invoiceSubmittedCompanyCategoryLabel)
      ),
      textRow(
        "campaign_sector",
        SC_MONTHLY_CAMPAIGN.campaignSector.label,
        text(b, invoiceSubmittedCampaignSectorLabel),
        text(a, invoiceSubmittedCampaignSectorLabel)
      ),
      textRow(
        "sustainability_category",
        SC_MONTHLY_CAMPAIGN.sustainabilityCategory.label,
        text(b, invoiceSubmittedSustainabilityCategoryLabel),
        text(a, invoiceSubmittedSustainabilityCategoryLabel)
      ),
      {
        key: "document",
        label: "Document",
        kind: "files",
        before: b ? invoiceDocumentFiles(b.details) : [],
        after: a ? invoiceDocumentFiles(a.details) : [],
      },
    ],
  };
}

/** Invoice Send offer: only the offered financing amount (what the comparison has always shown). */
function invoiceOfferBlock(pair: {
  id: string;
  before?: ComparisonInvoice;
  after?: ComparisonInvoice;
}): ComparisonBlock {
  return {
    id: invoiceOfferBlockId(pair.id),
    title: "Offer to issuer",
    rows: [
      textRow(
        "offered_amount",
        "Offered financing amount",
        pair.before ? invoiceOfferedAmountDisplay(pair.before) : null,
        pair.after ? invoiceOfferedAmountDisplay(pair.after) : null
      ),
    ],
  };
}

/** Invoice stages for the structure (details per invoice; existing/invoice_only add Send offer). */
function projectInvoiceStages(
  structure: OfferAcceptanceComparisonStructure,
  pairs: InvoicePair[]
): ComparisonStage[] {
  const detailBlocks = pairs.map(invoiceDetailsBlock);
  if (structure === "new_contract") {
    return [
      {
        id: OFFER_ACCEPTANCE_COMPARISON_INVOICES_STAGE_ID,
        title: "Invoice",
        blocks: detailBlocks,
      },
    ];
  }
  return [
    { id: "invoice_review", title: "Invoice review", blocks: detailBlocks },
    { id: "send_offer", title: "Send offer", blocks: pairs.map(invoiceOfferBlock) },
  ];
}

/**
 * Per-invoice block title asides, keyed by the blocks projectInvoiceStages emits for the structure
 * (no offer blocks for new_contract). Labels shared by several invoices (e.g. the "Invoice" fallback)
 * get the invoice's 1-based position in emitted order so each aside names one invoice.
 */
function invoiceBlockAsides(
  structure: OfferAcceptanceComparisonStructure,
  pairs: InvoicePair[]
): Record<string, string> {
  const labels = pairs.map(invoicePairLabel);
  const labelCounts = new Map<string, number>();
  for (const label of labels) labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
  const occurrences = new Map<string, number>();
  const blockAsides: Record<string, string> = {};
  pairs.forEach((pair, index) => {
    const base = labels[index]!;
    // Shared references are numbered among the duplicates only: "INV-005 (#1)", "INV-005 (#2)".
    const occurrence = (occurrences.get(base) ?? 0) + 1;
    occurrences.set(base, occurrence);
    const label = (labelCounts.get(base) ?? 0) > 1 ? `${base} (#${occurrence})` : base;
    blockAsides[invoiceDetailsBlockId(pair.id)] = label;
    if (structure !== "new_contract") blockAsides[invoiceOfferBlockId(pair.id)] = label;
  });
  return blockAsides;
}

export function projectOfferAcceptanceComparison(
  beforeApp: ReviewApplicationView,
  afterApp: ReviewApplicationView
): OfferAcceptanceComparisonProjection {
  const structure = resolveOfferAcceptanceComparisonStructure(afterApp);
  const pairs = pairInvoices(beforeApp, afterApp);
  return {
    contract_details: projectContractStages(structure, beforeApp, afterApp),
    invoice_details: projectInvoiceStages(structure, pairs),
    blockAsides: invoiceBlockAsides(structure, pairs),
  };
}

/** Diff check projects only the requested section's stages. */
export function offerAcceptanceComparisonHasChanges(
  section: "contract_details" | "invoice_details",
  beforeApp: ReviewApplicationView,
  afterApp: ReviewApplicationView
): boolean {
  const structure = resolveOfferAcceptanceComparisonStructure(afterApp);
  const stages =
    section === "contract_details"
      ? projectContractStages(structure, beforeApp, afterApp)
      : projectInvoiceStages(structure, pairInvoices(beforeApp, afterApp));
  return stagesHaveChanges(stages);
}
