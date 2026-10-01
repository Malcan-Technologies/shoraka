/**
 * SECTION: Business & Guarantor snapshot parsing (pure)
 * WHY: Live Business tab and the resubmit comparison projection must read business_details and
 *      guarantors identically; kept free of React/UI imports so the projection runs under jest.
 * INPUT: business_details JSON, relational application guarantors (or legacy business_details.guarantors)
 * OUTPUT: Normalized BusinessDetailsView + guarantor display helpers
 * WHERE USED: BusinessSection (live + comparison), business-projection
 */

import {
  GUARANTOR_COMPANY_RELATIONSHIP_LABELS,
  GUARANTOR_INDIVIDUAL_RELATIONSHIP_LABELS,
  isScFundRaisingPurpose,
  SC_FUND_RAISING_PURPOSE_LABELS,
  type GuarantorCompanyRelationship,
  type GuarantorIndividualRelationship,
} from "@cashsouk/types";
import { REVIEW_EMPTY_LABEL, isPlainObjectRecord, reviewStr } from "./shared-format";

type GuarantorAgreementFile = { s3Key: string; fileName: string; fileSize?: number };

export type GuarantorReviewRow =
  | ({
      kind: "individual";
      referenceId: string;
      name: string;
      icNumber: string;
      /** RegTank ISO 3166 alpha-2; empty if legacy row. */
      nationalityCode: string;
      email: string;
      relationship?: string;
      relationshipOther?: string;
    } & { guarantorAgreements: GuarantorAgreementFile[] })
  | ({
      kind: "company";
      referenceId: string;
      businessName: string;
      ssmNumber: string;
      email: string;
      relationship?: string;
    } & { guarantorAgreements: GuarantorAgreementFile[] });

export interface RelationalGuarantorEntry {
  id?: string;
  position?: number;
  client_guarantor_id?: string;
  guarantor_type?: string;
  email?: string;
  name?: string | null;
  ic_number?: string | null;
  business_name?: string | null;
  ssm_number?: string | null;
  guarantor?: Record<string, unknown> | null;
  aml_screening?: unknown;
  source_data?: unknown;
}

/** Normalized view model for Business Details review. Supports snake_case and camelCase from API/DB. */
export interface BusinessDetailsView {
  whyRaisingFunds: {
    purposeOfFundRaising: string;
    purposeOther: string | null;
    howFundsUsed: string;
    businessPlan: string;
    risksDelayRepayment: string;
    backupPlan: string;
    raisingOnOtherP2P: boolean | null;
    platformName: string;
    amountRaised: number | null;
    sameInvoiceUsed: boolean | null;
    supportingDocuments: Array<{ s3Key: string; fileName: string; fileSize?: number }>;
  };
  declarationConfirmed: boolean;
  guarantors: GuarantorReviewRow[];
}

function parsePurposeOfFundRaising(w: Record<string, unknown> | undefined): {
  purposeOfFundRaising: string;
  purposeOther: string | null;
} {
  const scRaw = w?.sc_purpose_of_fund_raising ?? w?.scPurposeOfFundRaising;
  const scOther = reviewStr(w?.sc_purpose_other ?? w?.scPurposeOther);
  if (isScFundRaisingPurpose(scRaw)) {
    return {
      purposeOfFundRaising: SC_FUND_RAISING_PURPOSE_LABELS[scRaw],
      purposeOther: scRaw === "OTHERS" ? scOther || REVIEW_EMPTY_LABEL : null,
    };
  }
  const legacy = reviewStr(w?.financing_for ?? w?.financingFor);
  return {
    purposeOfFundRaising: legacy || REVIEW_EMPTY_LABEL,
    purposeOther: null,
  };
}

function normalizeIdentifier(v: unknown): string {
  return reviewStr(v).replace(/[^A-Za-z0-9]+/g, "").toUpperCase();
}

export function normalizeEmail(v: unknown): string {
  return reviewStr(v).toLowerCase();
}

function safeToken(v: string): string {
  const token = v.replace(/[^A-Za-z0-9]+/g, "").toLowerCase();
  return token.length > 0 ? token : "unknown";
}

function deterministicGuarantorId(
  index: number,
  kind: "individual" | "company",
  icOrSsm: string
): string {
  return `g-${kind}-${safeToken(icOrSsm || `idx${index + 1}`)}`;
}

function parseGuarantorAgreementsField(raw: unknown): GuarantorAgreementFile[] {
  if (!raw) return [];
  const items = Array.isArray(raw) ? raw : [raw];
  const out: GuarantorAgreementFile[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const s3Key = reviewStr(o.s3_key ?? o.s3Key);
    if (!s3Key) continue;
    const fileName =
      reviewStr(o.file_name ?? o.fileName) || "Guarantor agreement.pdf";
    const sz = o.file_size ?? o.fileSize;
    const fileSize =
      typeof sz === "number" && Number.isFinite(sz) && sz > 0 ? sz : undefined;
    out.push({ s3Key, fileName, ...(fileSize != null ? { fileSize } : {}) });
  }
  return out;
}

export function guarantorNationalityCodeFromRelational(
  entry: RelationalGuarantorEntry,
  g: Record<string, unknown>
): string {
  const two = (v: unknown) => {
    const s = reviewStr(v).toUpperCase();
    return s.length === 2 ? s : "";
  };
  const fromG = two(g.nationality ?? g.nationality_code);
  if (fromG) return fromG;
  const entryRec = entry as Record<string, unknown>;
  const src = entryRec.source_data ?? entryRec.sourceData;
  if (isPlainObjectRecord(src)) {
    const fromSrc = two(src.nationality ?? src.nationality_code);
    if (fromSrc) return fromSrc;
  }
  return "";
}

function guarantorAgreementFromRelationalEntry(
  entry: RelationalGuarantorEntry,
  g: Record<string, unknown>
): GuarantorAgreementFile[] {
  const direct = parseGuarantorAgreementsField(
    g.guarantor_agreement ?? g.guarantorAgreement
  );
  if (direct.length > 0) return direct;
  const entryRec = entry as Record<string, unknown>;
  const src = entryRec.source_data ?? entryRec.sourceData;
  if (!isPlainObjectRecord(src)) return [];
  return parseGuarantorAgreementsField(
    src.guarantor_agreement ?? src.guarantorAgreement
  );
}

function parseGuarantors(raw: unknown): GuarantorReviewRow[] {
  if (!raw || !Array.isArray(raw)) return [];
  const rows: GuarantorReviewRow[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const item = raw[index];
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const gt = o.guarantor_type ?? o.guarantorType;
    const agreement = parseGuarantorAgreementsField(
      o.guarantor_agreement ?? o.guarantorAgreement
    );
    const ref =
      reviewStr(o.reference_id ?? o.referenceId ?? o.guarantor_id ?? o.guarantorId) ||
      deterministicGuarantorId(
        index,
        gt === "company" ? "company" : "individual",
        normalizeIdentifier(
          o.ic_number ?? o.icNumber ?? o.government_id_number ?? o.ssm_number ?? o.ssmNumber
        )
      );
    if (gt === "individual") {
      const legacyFirst = reviewStr(o.first_name ?? o.firstName);
      const legacyLast = reviewStr(o.last_name ?? o.lastName);
      const nameFromLegacy = [legacyFirst, legacyLast].filter(Boolean).join(" ").trim();
      const name = reviewStr(o.name) || nameFromLegacy;
      const gov = reviewStr(o.ic_number ?? o.icNumber ?? o.government_id_number);
      const nationalityRaw = reviewStr(o.nationality ?? o.nationality_code).toUpperCase();
      const nationalityCode = nationalityRaw.length === 2 ? nationalityRaw : "";
      const src = (o.source_data ?? o.sourceData) as Record<string, unknown> | null | undefined;
      const srcRel = reviewStr(src?.relationship);
      const srcRelOther = reviewStr(src?.relationship_other ?? src?.relationshipOther);
      const relationship = srcRel || reviewStr(o.relationship);
      const relationshipOther =
        relationship === "others"
          ? srcRelOther || reviewStr(o.relationship_other ?? o.relationshipOther)
          : undefined;
      rows.push({
        kind: "individual",
        referenceId: ref,
        name,
        icNumber: gov,
        nationalityCode,
        email: normalizeEmail(o.email),
        relationship: relationship || undefined,
        relationshipOther: relationshipOther || undefined,
        guarantorAgreements: agreement,
      });
    } else if (gt === "company") {
      const src = (o.source_data ?? o.sourceData) as Record<string, unknown> | null | undefined;
      const srcRel = reviewStr(src?.relationship);
      const relationship = srcRel || reviewStr(o.relationship);
      rows.push({
        kind: "company",
        referenceId: ref,
        businessName: reviewStr(o.business_name ?? o.businessName ?? o.company_name ?? o.companyName),
        ssmNumber: reviewStr(o.ssm_number ?? o.ssmNumber ?? o.business_id_number),
        email: normalizeEmail(o.email),
        relationship: relationship || undefined,
        guarantorAgreements: agreement,
      });
    }
  }
  return rows;
}

export function buildGuarantorAmlKey(row: GuarantorReviewRow): string {
  if (row.kind === "individual") {
    const gid = normalizeIdentifier(row.icNumber);
    if (gid) return `individual:${gid}`;
    return `individual:email:${normalizeEmail(row.email)}`;
  }
  const bid = normalizeIdentifier(row.ssmNumber);
  if (bid) return `company:${bid}`;
  return `company:email:${normalizeEmail(row.email)}`;
}

export function parseRelationalGuarantors(raw: unknown): GuarantorReviewRow[] {
  if (!Array.isArray(raw)) return [];
  const rows: GuarantorReviewRow[] = [];
  const sorted = [...raw]
    .map((item) => (item && typeof item === "object" ? (item as RelationalGuarantorEntry) : null))
    .filter((item): item is RelationalGuarantorEntry => Boolean(item))
    .sort((a, b) => (typeof a.position === "number" ? a.position : 0) - (typeof b.position === "number" ? b.position : 0));

  for (const entry of sorted) {
    const nested =
      entry.guarantor && typeof entry.guarantor === "object" && !Array.isArray(entry.guarantor)
        ? entry.guarantor
        : null;
    const g = (nested ?? entry) as Record<string, unknown>;
    const linkId = reviewStr(entry.id) || reviewStr(g.id);
    if (!linkId) continue;
    const ref = reviewStr(entry.client_guarantor_id) || linkId;
    const guarantorType = g.guarantor_type === "company" ? "company" : "individual";
    const agreement = guarantorAgreementFromRelationalEntry(entry, g);
    const src =
      entry.source_data && isPlainObjectRecord(entry.source_data)
        ? (entry.source_data as Record<string, unknown>)
        : {};
    const relValue = src.relationship;
    const relOtherValue = src.relationship_other;
    const relationship =
      typeof relValue === "string" ? relValue : undefined;
    const relationshipOther =
      typeof relOtherValue === "string" ? relOtherValue : undefined;
    if (guarantorType === "individual") {
      const legacyFirst = reviewStr(g.first_name);
      const legacyLast = reviewStr(g.last_name);
      const name =
        reviewStr(g.name) || [legacyFirst, legacyLast].filter(Boolean).join(" ").trim();
      const nationalityCode = guarantorNationalityCodeFromRelational(entry, g);
      rows.push({
        kind: "individual",
        referenceId: ref,
        name,
        icNumber: reviewStr(g.ic_number ?? g.government_id_number),
        nationalityCode,
        email: normalizeEmail(g.email),
        relationship: relationship || undefined,
        relationshipOther: relationship === "others" ? relationshipOther : undefined,
        guarantorAgreements: agreement,
      });
      continue;
    }
    rows.push({
      kind: "company",
      referenceId: ref,
      businessName: reviewStr(g.business_name ?? g.company_name),
      ssmNumber: reviewStr(g.ssm_number ?? g.business_id_number),
      email: normalizeEmail(g.email),
      relationship: relationship || undefined,
      guarantorAgreements: agreement,
    });
  }
  return rows;
}

export function guarantorRelationshipDisplay(g: GuarantorReviewRow): string {
  if (g.kind === "individual") {
    if (!g.relationship) return REVIEW_EMPTY_LABEL;
    const rel = g.relationship as GuarantorIndividualRelationship;
    const base = GUARANTOR_INDIVIDUAL_RELATIONSHIP_LABELS[rel];
    if (g.relationship === "others") {
      const other = (g.relationshipOther ?? "").trim();
      if (other) return `${base}: ${other}`;
      return base;
    }
    return base || REVIEW_EMPTY_LABEL;
  }

  if (!g.relationship) return REVIEW_EMPTY_LABEL;
  const rel = g.relationship as GuarantorCompanyRelationship;
  return GUARANTOR_COMPANY_RELATIONSHIP_LABELS[rel] || REVIEW_EMPTY_LABEL;
}

export function parseBusinessDetails(raw: unknown, relationalGuarantors?: GuarantorReviewRow[]): BusinessDetailsView | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const w = (r.why_raising_funds ?? r.whyRaisingFunds) as Record<string, unknown> | undefined;

  const bool = (v: unknown): boolean | null => {
    if (v === true || v === "yes") return true;
    if (v === false || v === "no") return false;
    return null;
  };

  const str = reviewStr;
  const supportDocsRaw = w?.supporting_documents ?? w?.supportingDocuments;
  const supportingDocuments = Array.isArray(supportDocsRaw)
    ? supportDocsRaw
        .map((doc, index) => {
          if (!doc || typeof doc !== "object") return null;
          const row = doc as Record<string, unknown>;
          const s3Key = reviewStr(row.s3_key ?? row.s3Key);
          if (!s3Key) return null;
          const fileName =
            reviewStr(row.file_name ?? row.fileName) || `Supporting Document ${index + 1}.pdf`;
          const sz = row.file_size ?? row.fileSize;
          const fileSize =
            typeof sz === "number" && Number.isFinite(sz) && sz > 0 ? sz : undefined;
          return { s3Key, fileName, ...(fileSize != null ? { fileSize } : {}) };
        })
        .filter((d): d is { s3Key: string; fileName: string; fileSize?: number } => Boolean(d))
    : [];

  const num = (v: unknown): number | null => {
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "string") {
      const parsed = parseFloat(v.replace(/[^0-9.-]/g, ""));
      return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
  };

  return {
    whyRaisingFunds: {
      ...parsePurposeOfFundRaising(w),
      howFundsUsed: str(w?.how_funds_used ?? w?.howFundsUsed) || REVIEW_EMPTY_LABEL,
      businessPlan: str(w?.business_plan ?? w?.businessPlan) || REVIEW_EMPTY_LABEL,
      risksDelayRepayment: str(w?.risks_delay_repayment ?? w?.risksDelayRepayment) || REVIEW_EMPTY_LABEL,
      backupPlan: str(w?.backup_plan ?? w?.backupPlan) || REVIEW_EMPTY_LABEL,
      raisingOnOtherP2P: bool(w?.raising_on_other_p2p ?? w?.raisingOnOtherP2P),
      platformName: str(w?.platform_name ?? w?.platformName) || REVIEW_EMPTY_LABEL,
      amountRaised: num(w?.amount_raised ?? w?.amountRaised),
      sameInvoiceUsed: bool(w?.same_invoice_used ?? w?.sameInvoiceUsed),
      supportingDocuments,
    },
    declarationConfirmed: Boolean(r.declaration_confirmed ?? r.declarationConfirmed),
    guarantors:
      relationalGuarantors && relationalGuarantors.length > 0
        ? relationalGuarantors
        : parseGuarantors(r.guarantors),
  };
}

export function guarantorKindLabel(kind: "individual" | "company"): string {
  return kind === "individual" ? "Individual" : "Company";
}

/** Collapsed-card subtitle (individual name or company name). */
export function guarantorReviewSubtitle(g: GuarantorReviewRow): string {
  if (g.kind === "individual") {
    return g.name.trim();
  }
  return g.businessName.trim();
}
