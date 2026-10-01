/**
 * SECTION: Business tab resubmit comparison projection
 * WHY: Same rows render the Business comparison and decide its Diff badge.
 * INPUT: Before / after review apps built from revision snapshots
 * OUTPUT: Blocks in render order: "Why Are You Raising Funds?", one block per guarantor
 *         (id `guarantor:<index>`), then "Declarations" — and a has-changes flag. Without
 *         business_details on either side only the guarantor blocks are emitted.
 * WHERE USED: Business section comparison branch, resubmit comparison modal badge
 *
 * Guarantor matching: by index after the live position sort, the same pairing the comparison
 * card list has always used. Link ids / client_guarantor_id can change between revisions, so they
 * are not reliable keys. A pure reorder therefore shows each slot's rows as changed (the rendered
 * rows really differ); renumbered positions that keep the order do not.
 */

import { formatCurrency } from "@cashsouk/config/src/currency";
import { regtankNationalityDisplayLabel, SC_MONTHLY_CAMPAIGN } from "@cashsouk/types";
import type { ReviewApplicationView } from "@/components/application-review/section-content";
import {
  blocksHaveChanges,
  type ComparisonBlock,
  type ComparisonFileRef,
  type ComparisonRow,
} from "./projection-types";
import {
  guarantorKindLabel,
  guarantorRelationshipDisplay,
  parseBusinessDetails,
  parseRelationalGuarantors,
  type BusinessDetailsView,
  type GuarantorReviewRow,
} from "./business-details-parse";
import { REVIEW_EMPTY_LABEL, formatFileSize } from "./shared-format";

export const BUSINESS_WHY_BLOCK_ID = "why_raising_funds";
export const BUSINESS_DECLARATIONS_BLOCK_ID = "declarations";
export const BUSINESS_GUARANTOR_BLOCK_PREFIX = "guarantor:";
/** Row keys the renderer reads back to build the guarantor card subtitle. */
export const GUARANTOR_ROW_KEYS = {
  type: "guarantor_type",
  individualName: "individual.name",
  companyName: "company.business_name",
} as const;

const ABSENT = "—";

function filesToRefs(files: ReadonlyArray<{ s3Key: string; fileName: string; fileSize?: number }>): ComparisonFileRef[] {
  return files.map((f) => ({
    s3Key: f.s3Key,
    fileName: f.fileName,
    ...(typeof f.fileSize === "number" && f.fileSize > 0 ? { secondary: formatFileSize(f.fileSize) } : {}),
  }));
}

function money(n: number | null): string {
  return n != null ? formatCurrency(n) : REVIEW_EMPTY_LABEL;
}

/** Same fallback as SectionContent: snapshot `application.guarantors`, else `application_guarantors`. */
function snapshotGuarantors(app: ReviewApplicationView): unknown {
  return (app as { application?: { guarantors?: unknown } }).application?.guarantors ?? app.application_guarantors;
}

function parseSide(app: ReviewApplicationView): {
  view: BusinessDetailsView | null;
  /** A side with no business_details object reads as empty (Not provided), never as the other side. */
  emptyView: BusinessDetailsView;
} {
  const relational = parseRelationalGuarantors(snapshotGuarantors(app));
  return {
    view: parseBusinessDetails(app.business_details, relational),
    emptyView: parseBusinessDetails({}, relational)!,
  };
}

function whyRaisingFundsBlock(b: BusinessDetailsView, a: BusinessDetailsView): ComparisonBlock {
  const bw = b.whyRaisingFunds;
  const aw = a.whyRaisingFunds;
  const rows: ComparisonRow[] = [
    {
      key: "purpose_of_fund_raising",
      label: "Purpose of Fund Raising",
      kind: "text",
      before: bw.purposeOfFundRaising,
      after: aw.purposeOfFundRaising,
      multiline: true,
    },
  ];
  if (bw.purposeOther != null || aw.purposeOther != null) {
    rows.push({
      key: "purpose_other",
      label: SC_MONTHLY_CAMPAIGN.purposeOfFundRaisingOthers.label,
      kind: "text",
      before: bw.purposeOther ?? REVIEW_EMPTY_LABEL,
      after: aw.purposeOther ?? REVIEW_EMPTY_LABEL,
      multiline: true,
    });
  }
  rows.push(
    {
      key: "how_funds_used",
      label: "How Will the Funds Be Used?",
      kind: "text",
      before: bw.howFundsUsed,
      after: aw.howFundsUsed,
      multiline: true,
    },
    {
      key: "business_plan",
      label: "Tell Us About Your Business Plan",
      kind: "text",
      before: bw.businessPlan,
      after: aw.businessPlan,
      multiline: true,
    },
    {
      key: "risks_delay_repayment",
      label: "Are There Any Risks That May Delay Repayment of Your Invoices?",
      kind: "text",
      before: bw.risksDelayRepayment,
      after: aw.risksDelayRepayment,
      multiline: true,
    },
    {
      key: "backup_plan",
      label: "If Payment Is Delayed, What Is Your Backup Plan?",
      kind: "text",
      before: bw.backupPlan,
      after: aw.backupPlan,
      multiline: true,
    },
    {
      key: "supporting_documents",
      label: "Relevant Supporting Documents for This Section",
      kind: "files",
      before: filesToRefs(bw.supportingDocuments),
      after: filesToRefs(aw.supportingDocuments),
    },
    {
      key: "raising_on_other_p2p",
      label: "Are You Currently Raising/Applying Funds on Any Other P2P Platforms?",
      kind: "yesno",
      before: bw.raisingOnOtherP2P,
      after: aw.raisingOnOtherP2P,
    }
  );
  if (bw.raisingOnOtherP2P === true || aw.raisingOnOtherP2P === true) {
    rows.push(
      {
        key: "platform_name",
        label: "Name of Platform",
        kind: "text",
        before: bw.platformName,
        after: aw.platformName,
      },
      {
        key: "amount_raised",
        label: "Amount Raised",
        kind: "text",
        before: money(bw.amountRaised),
        after: money(aw.amountRaised),
      },
      {
        key: "same_invoice_used",
        label: "Have the same invoices been used to apply for funding in the aforementioned platform?",
        kind: "yesno",
        before: bw.sameInvoiceUsed,
        after: aw.sameInvoiceUsed,
      }
    );
  }
  return { id: BUSINESS_WHY_BLOCK_ID, title: "Why Are You Raising Funds?", rows };
}

/** Value shown for one guarantor field; "—" when that side has no guarantor of this kind. */
function sideValue<K extends GuarantorReviewRow["kind"]>(
  g: GuarantorReviewRow | undefined,
  kind: K,
  read: (row: Extract<GuarantorReviewRow, { kind: K }>) => string
): string {
  if (g?.kind !== kind) return ABSENT;
  return read(g as Extract<GuarantorReviewRow, { kind: K }>);
}

function nationalityDisplay(code: string): string {
  return code ? regtankNationalityDisplayLabel(code) : REVIEW_EMPTY_LABEL;
}

function guarantorBlock(
  idx: number,
  gB: GuarantorReviewRow | undefined,
  gA: GuarantorReviewRow | undefined
): ComparisonBlock {
  const rows: ComparisonRow[] = [
    {
      key: GUARANTOR_ROW_KEYS.type,
      label: "Guarantor type",
      kind: "text",
      before: gB ? guarantorKindLabel(gB.kind) : ABSENT,
      after: gA ? guarantorKindLabel(gA.kind) : ABSENT,
    },
  ];
  const text = (key: string, label: string, before: string, after: string): ComparisonRow => ({
    key,
    label,
    kind: "text",
    before,
    after,
  });
  if (gB?.kind === "individual" || gA?.kind === "individual") {
    rows.push(
      text(
        GUARANTOR_ROW_KEYS.individualName,
        "Name",
        sideValue(gB, "individual", (g) => g.name || REVIEW_EMPTY_LABEL),
        sideValue(gA, "individual", (g) => g.name || REVIEW_EMPTY_LABEL)
      ),
      text(
        "individual.ic_number",
        "IC number",
        sideValue(gB, "individual", (g) => g.icNumber || REVIEW_EMPTY_LABEL),
        sideValue(gA, "individual", (g) => g.icNumber || REVIEW_EMPTY_LABEL)
      ),
      text(
        "individual.nationality",
        "Nationality",
        sideValue(gB, "individual", (g) => nationalityDisplay(g.nationalityCode)),
        sideValue(gA, "individual", (g) => nationalityDisplay(g.nationalityCode))
      ),
      text(
        "individual.relationship",
        "Relationship",
        sideValue(gB, "individual", guarantorRelationshipDisplay),
        sideValue(gA, "individual", guarantorRelationshipDisplay)
      ),
      text(
        "individual.email",
        "Email",
        sideValue(gB, "individual", (g) => g.email || REVIEW_EMPTY_LABEL),
        sideValue(gA, "individual", (g) => g.email || REVIEW_EMPTY_LABEL)
      )
    );
  }
  if (gB?.kind === "company" || gA?.kind === "company") {
    rows.push(
      text(
        GUARANTOR_ROW_KEYS.companyName,
        "Business name",
        sideValue(gB, "company", (g) => g.businessName || REVIEW_EMPTY_LABEL),
        sideValue(gA, "company", (g) => g.businessName || REVIEW_EMPTY_LABEL)
      ),
      text(
        "company.ssm_number",
        "SSM number",
        sideValue(gB, "company", (g) => g.ssmNumber || REVIEW_EMPTY_LABEL),
        sideValue(gA, "company", (g) => g.ssmNumber || REVIEW_EMPTY_LABEL)
      ),
      text(
        "company.relationship",
        "Relationship",
        sideValue(gB, "company", guarantorRelationshipDisplay),
        sideValue(gA, "company", guarantorRelationshipDisplay)
      ),
      text(
        "company.email",
        "Email",
        sideValue(gB, "company", (g) => g.email || REVIEW_EMPTY_LABEL),
        sideValue(gA, "company", (g) => g.email || REVIEW_EMPTY_LABEL)
      )
    );
  }
  rows.push({
    key: "guarantor_agreement",
    label: "Guarantor agreement",
    kind: "files",
    before: filesToRefs(gB?.guarantorAgreements ?? []),
    after: filesToRefs(gA?.guarantorAgreements ?? []),
  });
  return { id: `${BUSINESS_GUARANTOR_BLOCK_PREFIX}${idx}`, title: `Guarantor ${idx + 1}`, rows };
}

export function isBusinessGuarantorBlock(block: ComparisonBlock): boolean {
  return block.id.startsWith(BUSINESS_GUARANTOR_BLOCK_PREFIX);
}

/**
 * Card subtitle: the After guarantor's name when an After guarantor exists in this slot (blank →
 * "", the card title "Guarantor N" stands alone — never another guarantor's Before name). The
 * Before name only when the After guarantor is absent (removed card describes the removed record).
 */
export function businessGuarantorBlockSubtitle(block: ComparisonBlock): string {
  const typeRow = block.rows.find((r) => r.key === GUARANTOR_ROW_KEYS.type);
  if (typeRow?.kind !== "text") return "";
  const nameFor = (side: "before" | "after"): string | null => {
    const kind = typeRow[side];
    const key =
      kind === "Individual"
        ? GUARANTOR_ROW_KEYS.individualName
        : kind === "Company"
          ? GUARANTOR_ROW_KEYS.companyName
          : null;
    if (!key) return null;
    const row = block.rows.find((r) => r.key === key);
    const value = row?.kind === "text" ? row[side] : null;
    const name = value == null || value === REVIEW_EMPTY_LABEL ? "" : value.trim();
    return name === "" ? null : name;
  };
  const afterPresent = typeRow.after != null && typeRow.after !== ABSENT;
  return (afterPresent ? nameFor("after") : nameFor("before")) ?? "";
}

export function projectBusinessComparison(
  beforeApp: ReviewApplicationView,
  afterApp: ReviewApplicationView
): ComparisonBlock[] {
  const before = parseSide(beforeApp);
  const after = parseSide(afterApp);
  const b = before.view ?? before.emptyView;
  const a = after.view ?? after.emptyView;

  const guarantorCount = Math.max(b.guarantors.length, a.guarantors.length);
  const guarantorBlocks = Array.from({ length: guarantorCount }, (_, idx) =>
    guarantorBlock(idx, b.guarantors[idx], a.guarantors[idx])
  );

  // No business_details on either side: why / declarations have nothing to show, but relational
  // guarantors (application_guarantors) still render and diff.
  if (!before.view && !after.view) return guarantorBlocks;

  return [
    whyRaisingFundsBlock(b, a),
    ...guarantorBlocks,
    {
      id: BUSINESS_DECLARATIONS_BLOCK_ID,
      title: "Declarations",
      rows: [
        {
          key: "declaration_confirmed",
          label: "Declarations",
          kind: "yesno",
          before: b.declarationConfirmed,
          after: a.declarationConfirmed,
        },
      ],
    },
  ];
}

export function businessComparisonHasChanges(
  beforeApp: ReviewApplicationView,
  afterApp: ReviewApplicationView
): boolean {
  return blocksHaveChanges(projectBusinessComparison(beforeApp, afterApp));
}
