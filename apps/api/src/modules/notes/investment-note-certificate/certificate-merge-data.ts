import type { InvestmentNoteCertificateSnapshot } from "./types";
import {
  companyRegistrationForAudience,
  investorNameForAudience,
  issuerLegalNameForAudience,
  visibleCertificateInvestors,
  type CertificateRenderAudienceInput,
} from "./certificate-audience";
import {
  formatCertificateAmount,
  formatCertificateProfitRate,
  formatCertificateRm,
  formatCertificateShare,
} from "./certificate-format";

export type CertificateInvestorRowMerge = {
  rowNumber: string;
  investorId: string;
  investorName: string;
  principal: string;
  sharePercent: string;
  expectedProfit: string;
  lineTotalPayable: string;
};

export type CertificateDocxMergeData = {
  certificateNumber: string;
  certificateDate: string;
  noteReference: string;
  campaignId: string;
  issuerReference: string;
  businessSector: string;
  issuerLegalName: string;
  companyRegistration: string;
  campaignStatus: string;
  fundingCloseDate: string;
  targetAmount: string;
  fundedAmount: string;
  principalAmount: string;
  currency: string;
  profitRate: string;
  contractedProfit: string;
  totalPayable: string;
  repaymentProfile: string;
  issueDate: string;
  disbursementDate: string;
  tenure: string;
  maturityDate: string;
  shariahStructure: string;
  riskRating: string;
  invoiceReference: string;
  paymasterName: string;
  financingPurpose: string;
  securitySupport: string;
  investorScheduleReference: string;
  scheduleStatus: string;
  scheduleVersion: string;
  scheduleIssueDate: string;
  scheduleEffectiveDate: string;
  fundedPrincipal: string;
  paymentMaturityDate: string;
  paymentPrincipal: string;
  paymentExpectedProfit: string;
  paymentTotalPayable: string;
  investors: CertificateInvestorRowMerge[];
  sumPrincipal: string;
  sumSharePercent: string;
  sumExpectedProfit: string;
  sumTotalPayable: string;
  isIssuerAudience: boolean;
};

/**
 * Map a frozen certificate snapshot to docxtemplater values.
 * Does not recompute profit, maturity, or allocations.
 */
export function buildCertificateDocxMergeData(
  snapshot: InvestmentNoteCertificateSnapshot,
  input: CertificateRenderAudienceInput
): CertificateDocxMergeData {
  const investors = visibleCertificateInvestors(snapshot, input);
  const n = snapshot.note;
  const cert = snapshot.certificate;
  const schedule = snapshot.investorSchedule;

  const sumPrincipal = investors.reduce((sum, row) => sum + row.principal, 0);
  const sumShare = investors.reduce((sum, row) => sum + row.sharePercent, 0);
  const sumProfit = investors.reduce((sum, row) => sum + row.expectedGrossProfit, 0);
  const sumPayable = investors.reduce((sum, row) => sum + row.totalPayable, 0);
  const investorScoped = input.audience === "INVESTOR";

  return {
    certificateNumber: cert.certificateNumber,
    certificateDate: cert.certificateDateDisplay,
    noteReference: n.noteReference,
    campaignId: n.campaignReference,
    issuerReference: n.issuerReference,
    businessSector: n.businessSector,
    issuerLegalName: issuerLegalNameForAudience(snapshot, input.audience),
    companyRegistration: companyRegistrationForAudience(snapshot, input.audience),
    campaignStatus: n.campaignStatus,
    fundingCloseDate: n.fundingCloseDateDisplay,
    targetAmount: formatCertificateRm(n.targetAmount),
    fundedAmount: formatCertificateRm(n.fundedAmount),
    principalAmount: formatCertificateRm(n.principalAmount),
    currency: n.currency,
    profitRate: formatCertificateProfitRate(n.profitRatePercent),
    contractedProfit: formatCertificateRm(n.contractedProfit),
    totalPayable: formatCertificateRm(n.totalAmountPayable),
    repaymentProfile: n.repaymentProfile,
    issueDate: n.issueDateDisplay,
    disbursementDate: n.disbursementValueDateDisplay,
    tenure: `${n.tenureDays} days`,
    maturityDate: n.maturityDateDisplay,
    shariahStructure: n.shariahStructure,
    riskRating: n.riskRating,
    invoiceReference: n.underlyingInvoice,
    paymasterName: n.paymaster,
    financingPurpose: n.financingPurpose,
    securitySupport: n.securitySupport,
    investorScheduleReference: schedule.scheduleReference,
    scheduleStatus: schedule.status,
    scheduleVersion: schedule.version,
    scheduleIssueDate: schedule.issueDateDisplay,
    scheduleEffectiveDate: schedule.effectiveDateDisplay,
    fundedPrincipal: formatCertificateRm(schedule.fundedPrincipal),
    paymentMaturityDate: n.maturityDateDisplay,
    paymentPrincipal: formatCertificateAmount(n.principalAmount),
    paymentExpectedProfit: formatCertificateAmount(n.contractedProfit),
    paymentTotalPayable: formatCertificateAmount(n.totalAmountPayable),
    investors: investors.map((row, index) => ({
      rowNumber: String(index + 1),
      investorId: row.investorReference,
      investorName: investorNameForAudience(row.investorName, input.audience),
      principal: formatCertificateAmount(row.principal),
      sharePercent: formatCertificateShare(row.sharePercent),
      expectedProfit: formatCertificateAmount(row.expectedGrossProfit),
      lineTotalPayable: formatCertificateAmount(row.totalPayable),
    })),
    sumPrincipal: formatCertificateAmount(investorScoped ? sumPrincipal : n.fundedAmount),
    sumSharePercent: investorScoped ? formatCertificateShare(sumShare) : "100.00%",
    sumExpectedProfit: formatCertificateAmount(investorScoped ? sumProfit : n.contractedProfit),
    sumTotalPayable: formatCertificateAmount(investorScoped ? sumPayable : n.totalAmountPayable),
    isIssuerAudience: input.audience === "ISSUER",
  };
}
