import {
  allocateProRataNoteMoney,
  NOTE_MONEY_TOLERANCE,
  roundNoteMoney,
} from "@cashsouk/types";
import { calculateCeilingAwareGrossProfit } from "../calculators";
import { CertificateGenerationError, type CertificateSnapshotInvestor } from "./types";

export type EligibleCertificateInvestment = {
  investorOrganizationId: string;
  investorReference: string;
  investorName: string;
  amount: number;
};

export function money2(value: number): number {
  return roundNoteMoney(value, 2);
}

export function calculateCertificateContractedProfit(input: {
  fundedPrincipal: number;
  annualRatePercent: number;
  tenureDays: number;
  invoiceFaceValue: number;
}): { contractedProfit: number; capped: boolean } {
  const result = calculateCeilingAwareGrossProfit({
    fundedPrincipal: input.fundedPrincipal,
    annualRatePercent: input.annualRatePercent,
    profitDays: input.tenureDays,
    invoiceFaceValue: input.invoiceFaceValue,
  });
  return {
    contractedProfit: money2(result.investorProfitGross),
    capped: result.capped,
  };
}

/**
 * Pro-rata share, gross profit and totals from actual funded principal.
 * Last-row remainder via allocateProRataNoteMoney so displayed lines sum exactly.
 */
export function allocateCertificateInvestors(input: {
  investments: EligibleCertificateInvestment[];
  fundedPrincipal: number;
  contractedProfit: number;
}): CertificateSnapshotInvestor[] {
  const weights = input.investments.map((row) => row.amount);
  const principals = allocateProRataNoteMoney(input.fundedPrincipal, weights);
  const profits = allocateProRataNoteMoney(input.contractedProfit, principals);
  const sharePercents = allocateProRataNoteMoney(100, principals);

  return input.investments.map((row, index) => {
    const principal = principals[index] ?? 0;
    const expectedGrossProfit = profits[index] ?? 0;
    return {
      investorOrganizationId: row.investorOrganizationId,
      investorReference: row.investorReference,
      investorName: row.investorName,
      principal,
      sharePercent: sharePercents[index] ?? 0,
      expectedGrossProfit,
      totalPayable: money2(principal + expectedGrossProfit),
    };
  });
}

export function assertCertificateReconciliation(input: {
  fundedPrincipal: number;
  contractedProfit: number;
  totalAmountPayable: number;
  investors: CertificateSnapshotInvestor[];
}): void {
  const sumPrincipal = money2(input.investors.reduce((sum, row) => sum + row.principal, 0));
  const sumShare = money2(input.investors.reduce((sum, row) => sum + row.sharePercent, 0));
  const sumProfit = money2(
    input.investors.reduce((sum, row) => sum + row.expectedGrossProfit, 0)
  );
  const sumPayable = money2(input.investors.reduce((sum, row) => sum + row.totalPayable, 0));

  const failures: string[] = [];
  if (Math.abs(sumPrincipal - input.fundedPrincipal) > NOTE_MONEY_TOLERANCE) {
    failures.push(
      `investor principal ${sumPrincipal.toFixed(2)} != funded principal ${input.fundedPrincipal.toFixed(2)}`
    );
  }
  if (Math.abs(sumShare - 100) > NOTE_MONEY_TOLERANCE) {
    failures.push(`share percent ${sumShare.toFixed(2)} != 100.00`);
  }
  if (Math.abs(sumProfit - input.contractedProfit) > NOTE_MONEY_TOLERANCE) {
    failures.push(
      `investor gross profit ${sumProfit.toFixed(2)} != contracted profit ${input.contractedProfit.toFixed(2)}`
    );
  }
  if (Math.abs(sumPayable - input.totalAmountPayable) > NOTE_MONEY_TOLERANCE) {
    failures.push(
      `investor total payable ${sumPayable.toFixed(2)} != certificate total ${input.totalAmountPayable.toFixed(2)}`
    );
  }
  if (failures.length > 0) {
    throw new CertificateGenerationError(
      `Certificate reconciliation failed: ${failures.join("; ")}`,
      "RECONCILIATION_FAILED"
    );
  }
}
