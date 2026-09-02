import type { InvestmentNoteCertificateAudience } from "@cashsouk/types";
import {
  INVESTMENT_NOTE_CERTIFICATE_TEMPLATE_ID,
  INVESTMENT_NOTE_CERTIFICATE_VERSION_V01,
} from "@cashsouk/types";

export const CERTIFICATE_TEMPLATE_ID = INVESTMENT_NOTE_CERTIFICATE_TEMPLATE_ID;
export const CERTIFICATE_FIRST_VERSION = INVESTMENT_NOTE_CERTIFICATE_VERSION_V01;

export const CERTIFICATE_CAMPAIGN_STATUS = "Successfully funded";
export const CERTIFICATE_CURRENCY_LABEL = "Malaysian Ringgit (RM)";
export const CERTIFICATE_SECURITY_SUPPORT = "—";
export const CERTIFICATE_SCHEDULE_STATUS = "Approved / Final";

export const ELIGIBLE_INVESTMENT_STATUSES = ["CONFIRMED", "SETTLED"] as const;

export type CertificateAudience = InvestmentNoteCertificateAudience;

export type CertificateGenerationSource = "DISBURSEMENT_COMPLETED" | "ADMIN_RETRY";

export type CertificateSnapshotInvestor = {
  investorOrganizationId: string;
  investorReference: string;
  investorName: string;
  principal: number;
  sharePercent: number;
  expectedGrossProfit: number;
  totalPayable: number;
};

export type InvestmentNoteCertificateSnapshot = {
  templateId: string;
  templateVersion: string;
  snapshotGeneratedAt: string;
  snapshotSha256: string;
  certificate: {
    certificateNumber: string;
    version: string;
    certificateDate: string;
    certificateDateDisplay: string;
  };
  note: {
    noteId: string;
    noteReference: string;
    campaignReference: string;
    issuerReference: string;
    businessSector: string;
    issuerLegalName: string;
    companyRegistrationNumber: string;
    campaignStatus: string;
    fundingCloseDate: string | null;
    fundingCloseDateDisplay: string;
    targetAmount: number;
    fundedAmount: number;
    principalAmount: number;
    currency: string;
    profitRatePercent: number;
    contractedProfit: number;
    contractedProfitCapped: boolean;
    totalAmountPayable: number;
    repaymentProfile: string;
    issueDate: string | null;
    issueDateDisplay: string;
    disbursementValueDate: string | null;
    disbursementValueDateDisplay: string;
    tenureDays: number;
    maturityDate: string | null;
    maturityDateDisplay: string;
    shariahStructure: string;
    riskRating: string;
    underlyingInvoice: string;
    paymaster: string;
    financingPurpose: string;
    securitySupport: string;
  };
  investorSchedule: {
    scheduleReference: string;
    version: string;
    status: string;
    issueDate: string | null;
    issueDateDisplay: string;
    effectiveDate: string | null;
    effectiveDateDisplay: string;
    fundedPrincipal: number;
  };
  investors: CertificateSnapshotInvestor[];
};

export class CertificateGenerationError extends Error {
  constructor(
    message: string,
    readonly code:
      | "INCOMPLETE_DATA"
      | "NOT_FUNDED"
      | "RECONCILIATION_FAILED"
      | "GOTENBERG_FAILED"
      | "S3_FAILED"
  ) {
    super(message);
    this.name = "CertificateGenerationError";
  }
}

export function certificateAudienceScopeKey(
  audience: CertificateAudience,
  investorOrganizationId: string | null
): string {
  if (audience === "INVESTOR") {
    if (!investorOrganizationId) {
      throw new CertificateGenerationError(
        "Investor audience requires investor_organization_id",
        "INCOMPLETE_DATA"
      );
    }
    return `INVESTOR:${investorOrganizationId}`;
  }
  return audience;
}

export function certificateNumberFor(noteReference: string): string {
  return `IINC-${noteReference}`;
}

export function investorScheduleReferenceFor(noteReference: string, version: string): string {
  return `IS-${noteReference}-${version}`;
}
