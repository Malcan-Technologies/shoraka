import { createHash } from "crypto";
import {
  NoteFundingStatus,
  NoteInvestmentStatus,
  OrganizationType,
  type Prisma,
} from "@prisma/client";
import {
  formatUtcCalendarDateEnMy,
  PROSPECTUS_FIXED_PAYMENT_BASIS,
  PROSPECTUS_FIXED_SHARIAH_PRINCIPLE,
  roundNoteMoney,
} from "@cashsouk/types";
import { prisma } from "../../../lib/prisma";
import { parseInvoiceSnapshotRiskRating } from "../prospectus/prospectus-json-guards";
import {
  allocateCertificateInvestors,
  assertCertificateReconciliation,
  calculateCertificateContractedProfit,
  money2,
} from "./calculations";
import {
  CERTIFICATE_CAMPAIGN_STATUS,
  CERTIFICATE_CURRENCY_LABEL,
  CERTIFICATE_FIRST_VERSION,
  CERTIFICATE_SCHEDULE_STATUS,
  CERTIFICATE_SECURITY_SUPPORT,
  CERTIFICATE_TEMPLATE_ID,
  CertificateGenerationError,
  certificateNumberFor,
  ELIGIBLE_INVESTMENT_STATUSES,
  investorScheduleReferenceFor,
  type InvestmentNoteCertificateSnapshot,
} from "./types";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nonEmpty(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value && typeof value === "object" && "toNumber" in value) {
    const n = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function isoDate(value: Date | null | undefined): string | null {
  if (!value || Number.isNaN(value.getTime())) return null;
  return value.toISOString();
}

function displayUtcDate(value: Date | string | null | undefined): string {
  return formatUtcCalendarDateEnMy(value) ?? "—";
}

function formatCertificateDateMy(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(value);
}

function resolveInvoiceFaceValue(note: {
  invoice_snapshot?: Prisma.JsonValue | null;
  requested_amount?: Prisma.Decimal | number | string | null;
}): number {
  const invoice = asRecord(note.invoice_snapshot);
  const details = asRecord(invoice?.details);
  const offerDetails = asRecord(invoice?.offer_details);
  return (
    toNumber(details?.value) ||
    toNumber(details?.invoice_value) ||
    toNumber(details?.invoiceAmount) ||
    toNumber(offerDetails?.invoice_value) ||
    toNumber(note.requested_amount)
  );
}

function resolveInvoiceReference(invoiceSnapshot: unknown): string {
  const invoice = asRecord(invoiceSnapshot);
  const details = asRecord(invoice?.details);
  return (
    nonEmpty(details?.number) ??
    nonEmpty(details?.invoice_number) ??
    nonEmpty(details?.invoiceNumber) ??
    "—"
  );
}

function resolvePaymasterName(paymasterSnapshot: unknown): string {
  const snap = asRecord(paymasterSnapshot);
  return nonEmpty(snap?.name) ?? nonEmpty(snap?.legal_name) ?? "—";
}

function resolveFinancingPurpose(purposeSnapshot: unknown): string {
  const snap = asRecord(purposeSnapshot);
  return nonEmpty(snap?.financing_for) ?? "—";
}

function freezeInvestorName(org: {
  type: OrganizationType | string;
  name: string | null;
  legal_name_on_id?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  corporate_onboarding_data?: Prisma.JsonValue | null;
}): string {
  if (org.type === OrganizationType.COMPANY || org.type === "COMPANY") {
    const data = asRecord(org.corporate_onboarding_data);
    const businessName = nonEmpty(asRecord(data?.basicInfo)?.businessName);
    if (businessName) return businessName;
  }
  if (nonEmpty(org.legal_name_on_id)) return org.legal_name_on_id!.trim();
  const parts = [org.first_name, org.middle_name, org.last_name]
    .map((part) => nonEmpty(part))
    .filter((part): part is string => Boolean(part));
  if (parts.length > 0) return parts.join(" ");
  return nonEmpty(org.name) ?? "—";
}

function canonicalJsonSha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function isValidPersistedSnapshot(value: unknown): value is InvestmentNoteCertificateSnapshot {
  const record = asRecord(value);
  const certificate = asRecord(record?.certificate);
  const note = asRecord(record?.note);
  return Boolean(
    nonEmpty(certificate?.certificateNumber) &&
      Array.isArray(record?.investors) &&
      typeof note?.fundedAmount === "number"
  );
}

export function parseCertificateSnapshot(
  value: unknown
): InvestmentNoteCertificateSnapshot | null {
  return isValidPersistedSnapshot(value) ? (value as InvestmentNoteCertificateSnapshot) : null;
}

/**
 * Build the immutable certificate snapshot from frozen note fields and
 * participating investments at issue time. Does not read live MARC assessments.
 */
export async function buildInvestmentNoteCertificateSnapshot(
  noteId: string,
  generatedAt = new Date()
): Promise<InvestmentNoteCertificateSnapshot> {
  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: {
      id: true,
      note_reference: true,
      funding_status: true,
      issuer_organization_id: true,
      issuer_snapshot: true,
      paymaster_snapshot: true,
      purpose_snapshot: true,
      invoice_snapshot: true,
      requested_amount: true,
      target_amount: true,
      funded_amount: true,
      profit_rate_percent: true,
      tenure_days: true,
      disbursement_value_date: true,
      maturity_date: true,
      funding_closed_at: true,
    },
  });
  if (!note) {
    throw new CertificateGenerationError("Note not found", "INCOMPLETE_DATA");
  }
  if (note.funding_status !== NoteFundingStatus.FUNDED) {
    throw new CertificateGenerationError(
      "Certificate requires funding_status FUNDED",
      "NOT_FUNDED"
    );
  }

  const missing: string[] = [];
  if (note.tenure_days == null || note.tenure_days <= 0) missing.push("tenure_days");
  if (!note.disbursement_value_date) missing.push("disbursement_value_date");
  if (!note.maturity_date) missing.push("maturity_date");
  if (note.profit_rate_percent == null) missing.push("profit_rate_percent");
  if (missing.length > 0) {
    throw new CertificateGenerationError(
      `Required certificate data is incomplete: ${missing.join(", ")}`,
      "INCOMPLETE_DATA"
    );
  }

  const fundedAmount = money2(toNumber(note.funded_amount));
  if (fundedAmount <= 0) {
    throw new CertificateGenerationError("Funded principal is missing", "INCOMPLETE_DATA");
  }

  const investments = await prisma.noteInvestment.findMany({
    where: {
      note_id: noteId,
      status: { in: [...ELIGIBLE_INVESTMENT_STATUSES] as NoteInvestmentStatus[] },
    },
    orderBy: [{ committed_at: "asc" }, { id: "asc" }],
    select: {
      investor_organization_id: true,
      amount: true,
    },
  });
  if (investments.length === 0) {
    throw new CertificateGenerationError(
      "No confirmed participating investments",
      "INCOMPLETE_DATA"
    );
  }

  const orgIds = [...new Set(investments.map((row) => row.investor_organization_id))];
  const [issuerOrg, investorOrgs] = await Promise.all([
    prisma.issuerOrganization.findUnique({
      where: { id: note.issuer_organization_id },
      select: { display_reference: true },
    }),
    prisma.investorOrganization.findMany({
      where: { id: { in: orgIds } },
      select: {
        id: true,
        type: true,
        name: true,
        legal_name_on_id: true,
        first_name: true,
        middle_name: true,
        last_name: true,
        corporate_onboarding_data: true,
        display_reference: true,
      },
    }),
  ]);
  const investorOrgById = new Map(investorOrgs.map((org) => [org.id, org]));

  const issuerSnapshot = asRecord(note.issuer_snapshot);
  const profitRatePercent = toNumber(note.profit_rate_percent);
  const invoiceFaceValue = resolveInvoiceFaceValue(note);
  const { contractedProfit, capped } = calculateCertificateContractedProfit({
    fundedPrincipal: fundedAmount,
    annualRatePercent: profitRatePercent,
    tenureDays: note.tenure_days!,
    invoiceFaceValue,
  });
  const totalAmountPayable = money2(fundedAmount + contractedProfit);

  const allocated = allocateCertificateInvestors({
    investments: investments.map((row) => {
      const org = investorOrgById.get(row.investor_organization_id);
      return {
        investorOrganizationId: row.investor_organization_id,
        investorReference: nonEmpty(org?.display_reference) ?? row.investor_organization_id,
        investorName: org ? freezeInvestorName(org) : "—",
        amount: toNumber(row.amount),
      };
    }),
    fundedPrincipal: fundedAmount,
    contractedProfit,
  });

  assertCertificateReconciliation({
    fundedPrincipal: fundedAmount,
    contractedProfit,
    totalAmountPayable,
    investors: allocated,
  });

  const disbursementIso = isoDate(note.disbursement_value_date);
  const maturityIso = isoDate(note.maturity_date);
  const riskRating = parseInvoiceSnapshotRiskRating(note.invoice_snapshot) ?? "—";

  const withoutHash = {
    templateId: CERTIFICATE_TEMPLATE_ID,
    templateVersion: CERTIFICATE_FIRST_VERSION,
    snapshotGeneratedAt: generatedAt.toISOString(),
    snapshotSha256: "",
    certificate: {
      certificateNumber: certificateNumberFor(note.note_reference),
      version: CERTIFICATE_FIRST_VERSION,
      certificateDate: generatedAt.toISOString(),
      certificateDateDisplay: formatCertificateDateMy(generatedAt),
    },
    note: {
      noteId: note.id,
      noteReference: note.note_reference,
      campaignReference: note.note_reference,
      issuerReference: nonEmpty(issuerOrg?.display_reference) ?? note.issuer_organization_id,
      businessSector: nonEmpty(issuerSnapshot?.industry) ?? "—",
      issuerLegalName: nonEmpty(issuerSnapshot?.name) ?? "—",
      companyRegistrationNumber: nonEmpty(issuerSnapshot?.registration_number) ?? "—",
      campaignStatus: CERTIFICATE_CAMPAIGN_STATUS,
      fundingCloseDate: isoDate(note.funding_closed_at),
      fundingCloseDateDisplay: displayUtcDate(note.funding_closed_at),
      targetAmount: money2(toNumber(note.target_amount)),
      fundedAmount,
      principalAmount: fundedAmount,
      currency: CERTIFICATE_CURRENCY_LABEL,
      profitRatePercent: roundNoteMoney(profitRatePercent, 4),
      contractedProfit,
      contractedProfitCapped: capped,
      totalAmountPayable,
      repaymentProfile: PROSPECTUS_FIXED_PAYMENT_BASIS,
      issueDate: disbursementIso,
      issueDateDisplay: displayUtcDate(note.disbursement_value_date),
      disbursementValueDate: disbursementIso,
      disbursementValueDateDisplay: displayUtcDate(note.disbursement_value_date),
      tenureDays: note.tenure_days!,
      maturityDate: maturityIso,
      maturityDateDisplay: displayUtcDate(note.maturity_date),
      shariahStructure: PROSPECTUS_FIXED_SHARIAH_PRINCIPLE,
      riskRating,
      underlyingInvoice: resolveInvoiceReference(note.invoice_snapshot),
      paymaster: resolvePaymasterName(note.paymaster_snapshot),
      financingPurpose: resolveFinancingPurpose(note.purpose_snapshot),
      securitySupport: CERTIFICATE_SECURITY_SUPPORT,
    },
    investorSchedule: {
      scheduleReference: investorScheduleReferenceFor(
        note.note_reference,
        CERTIFICATE_FIRST_VERSION
      ),
      version: CERTIFICATE_FIRST_VERSION,
      status: CERTIFICATE_SCHEDULE_STATUS,
      issueDate: disbursementIso,
      issueDateDisplay: displayUtcDate(note.disbursement_value_date),
      effectiveDate: disbursementIso,
      effectiveDateDisplay: displayUtcDate(note.disbursement_value_date),
      fundedPrincipal: fundedAmount,
    },
    investors: allocated,
  };

  return {
    ...withoutHash,
    snapshotSha256: canonicalJsonSha256(withoutHash),
  };
}
