import type { ResolvedTrusteeConfig } from "./trustee-letter-config.loader";
import type { RepaymentBorrowerEntry, TrusteeLetterData, TrusteePaymentRow } from "./trustee-letter.types";
import type { TrusteeAccountDetails } from "@cashsouk/types";

const OPENING_PARAGRAPH =
  "The above matter refers. We hereby authorise you to debit the abovementioned account and remit the sum to the following beneficiaries:";

function formatRm(amount: number): string {
  return amount.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatLetterDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function addBusinessDays(start: Date, days: number): Date {
  const result = new Date(start);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return result;
}

export function resolveTrusteeValueDate(behavior: string, referenceDate?: Date): string {
  const base = referenceDate ?? new Date();
  const normalized = behavior.trim().toLowerCase();
  if (normalized === "same_day" || normalized === "same day") {
    return formatLetterDate(base);
  }
  return formatLetterDate(addBusinessDays(base, 1));
}

function buildOurRef(prefix: string, suffix: string): string {
  return `${prefix}/${suffix}`;
}

function accountRow(account: TrusteeAccountDetails, amount: number, remarks: string): Omit<TrusteePaymentRow, "no"> {
  return {
    nameOfPayee: account.displayName || account.accountName || remarks,
    accountNo: account.accountNumber,
    banker: account.bankName,
    amount,
    remarks: account.remarks || remarks,
  };
}

function addPaymentRowIfPositive(input: {
  rows: TrusteePaymentRow[];
  rowNo: number;
  nameOfPayee: string;
  account: TrusteeAccountDetails;
  amount: number;
  remarks: string;
}): number {
  if (!Number.isFinite(input.amount) || input.amount <= 0.005) return input.rowNo;
  input.rows.push({
    no: input.rowNo,
    ...accountRow(input.account, input.amount, input.remarks),
    nameOfPayee: input.nameOfPayee,
    remarks: input.remarks,
  });
  return input.rowNo + 1;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function numberFromMeta(metadata: Record<string, unknown> | null, key: string): number {
  if (!metadata) return 0;
  const value = metadata[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function beneficiaryField(snapshot: Record<string, unknown>, key: string): string {
  const value = snapshot[key];
  return typeof value === "string" ? value : "";
}

export function mapDisbursementLetterData(input: {
  withdrawalId: string;
  withdrawalAmount: number;
  beneficiarySnapshot: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
  config: ResolvedTrusteeConfig;
  referenceDate?: Date;
}): TrusteeLetterData {
  const { letterConfig, bucketAccounts } = input.config;
  const debit = bucketAccounts.INVESTOR_POOL;
  const operatingAccount = bucketAccounts.OPERATING_ACCOUNT;
  const platformFee = numberFromMeta(input.metadata, "platformFeeAmount");
  const successFee = numberFromMeta(input.metadata, "successFeeAmount");
  const facilityFee = numberFromMeta(input.metadata, "facilityFeeCharged");
  const netDisbursement = numberFromMeta(input.metadata, "netIssuerDisbursement") || input.withdrawalAmount;

  const rows: TrusteePaymentRow[] = [];
  let rowNo = 1;

  if (netDisbursement > 0.005) {
    rows.push({
      no: rowNo++,
      nameOfPayee: "Disbursement to Borrower",
      accountNo: beneficiaryField(input.beneficiarySnapshot, "account_number"),
      banker: beneficiaryField(input.beneficiarySnapshot, "bank_name"),
      amount: netDisbursement,
      remarks: beneficiaryField(input.beneficiarySnapshot, "account_holder") || "Disbursement to Borrower",
    });
  }

  if (platformFee > 0.005 && successFee > 0.005) {
    rowNo = addPaymentRowIfPositive({
      rows,
      rowNo,
      nameOfPayee: "Platform Fee to Platform",
      account: operatingAccount,
      amount: platformFee,
      remarks: "Platform Fee to Platform",
    });
    rowNo = addPaymentRowIfPositive({
      rows,
      rowNo,
      nameOfPayee: "Success Fee to Platform",
      account: operatingAccount,
      amount: successFee,
      remarks: "Success Fee to Platform",
    });
  } else if (platformFee > 0.005 || successFee > 0.005) {
    // TODO: render platform fee and success fee as separate rows once upstream disbursement metadata
    // always stores separate amount fields for both categories.
    const combinedFee = platformFee + successFee;
    rowNo = addPaymentRowIfPositive({
      rows,
      rowNo,
      nameOfPayee: "Success Fees to Platform",
      account: operatingAccount,
      amount: combinedFee,
      remarks: "Success Fees to Platform",
    });
  }

  rowNo = addPaymentRowIfPositive({
    rows,
    rowNo,
    nameOfPayee: "Facility Fee to Platform",
    account: operatingAccount,
    amount: facilityFee,
    remarks: "Facility Fee to Platform",
  });

  const now = input.referenceDate ?? new Date();
  return {
    ourRef: buildOurRef(letterConfig.defaultLetterRefPrefix, input.withdrawalId.slice(-8).toUpperCase()),
    date: formatLetterDate(now),
    trusteeName: letterConfig.trusteeName,
    trusteeAddressLines: [
      letterConfig.trusteeAddressLine1,
      letterConfig.trusteeAddressLine2,
      letterConfig.trusteeAddressLine3 ?? "",
    ].filter(Boolean),
    attentionPerson: letterConfig.attentionPerson,
    platformDisplayName: letterConfig.platformDisplayName,
    instructionTitle: "Instruction of Payment",
    debitAccountNumber: debit.accountNumber,
    debitAccountName: debit.accountName || debit.displayName || "Investor Pool Account",
    valueDate: resolveTrusteeValueDate(letterConfig.defaultValueDateBehavior, now),
    purpose: "Disbursement to Borrower and Platform",
    openingParagraph: OPENING_PARAGRAPH,
    paymentRows: rows,
    supportingParagraph: "",
    contactPerson: letterConfig.defaultContactPerson,
    enclosingDocuments: true,
    authorisedSignatoryLabel: letterConfig.authorisedSignatoryLabel,
  };
}

function buildRepaymentSupportingParagraph(input: {
  borrowerEntries: RepaymentBorrowerEntry[];
  repaymentAccountName: string;
  investorPoolAccountName: string;
  serviceFeeAccountNumber: string;
}): string {
  const { borrowerEntries, repaymentAccountName, investorPoolAccountName, serviceFeeAccountNumber } =
    input;

  if (borrowerEntries.length > 1) {
    const list = borrowerEntries
      .map((entry) => `${entry.name} of RM${formatRm(entry.amount)} on ${entry.date}`)
      .join("\n");
    return (
      `Please note that there was a repayment made by Borrower(s) as listed below into ${repaymentAccountName} account. ` +
      `Part of the repayment is now allocated back to Investors (Credit to ${investorPoolAccountName}) and remaining amount to Platform as the Service fee ` +
      `(Credit to Platform account no. ${serviceFeeAccountNumber}).\n${list}`
    );
  }

  const entry = borrowerEntries[0];
  if (!entry) {
    return (
      "Please note that there was a repayment made by Borrower(s). Part of the repayment is now allocated back to Investors " +
      `and remaining amount to Platform as the Service fee (Credit to Platform account no. ${serviceFeeAccountNumber}).`
    );
  }

  return (
    `Please note that there was a repayment made by Borrower(s), ${entry.name} on ${entry.date} for RM${formatRm(entry.amount)} ` +
    `into ${repaymentAccountName} account. Part of the repayment is now allocated back to Investors (Credit to ${investorPoolAccountName}) ` +
    `and remaining amount to Platform as the Service fee (Credit to Platform account no. ${serviceFeeAccountNumber}).`
  );
}

export function mapRepaymentLetterData(input: {
  settlementId: string;
  investorPrincipal: number;
  investorProfitNet: number;
  serviceFeeAmount: number;
  platformFeeAmount?: number;
  tawidhAccountAmount: number;
  gharamahAmount: number;
  issuerResidualAmount: number;
  issuerBeneficiarySnapshot?: Record<string, unknown> | null;
  issuerOrganizationName?: string | null;
  borrowerEntries: RepaymentBorrowerEntry[];
  repaymentAccountName: string;
  config: ResolvedTrusteeConfig;
  referenceDate?: Date;
}): TrusteeLetterData {
  const { letterConfig, bucketAccounts } = input.config;
  const debit = bucketAccounts.REPAYMENT_POOL;
  const investorPool = bucketAccounts.INVESTOR_POOL;
  const operatingAccount = bucketAccounts.OPERATING_ACCOUNT;

  const investorRepayment = input.investorPrincipal + input.investorProfitNet;

  const rows: TrusteePaymentRow[] = [];
  let rowNo = 1;

  if (investorRepayment > 0.005) {
    rows.push({
      no: rowNo++,
      nameOfPayee: "Repayment to Investors / Deposit Account",
      accountNo: investorPool.accountNumber,
      banker: investorPool.bankName,
      amount: investorRepayment,
      remarks: investorPool.displayName || "Repayment to Investors / Deposit Account",
    });
  }

  rowNo = addPaymentRowIfPositive({
    rows,
    rowNo,
    nameOfPayee: "Service Fee to Platform",
    account: operatingAccount,
    amount: input.serviceFeeAmount,
    remarks: "Service Fee to Platform",
  });

  // TODO: no separate platform-fee amount is currently persisted in NoteSettlement.
  // Keep this optional for forward compatibility when upstream starts storing it.
  rowNo = addPaymentRowIfPositive({
    rows,
    rowNo,
    nameOfPayee: "Platform Fee to Platform",
    account: operatingAccount,
    amount: input.platformFeeAmount ?? 0,
    remarks: "Platform Fee to Platform",
  });

  if (input.tawidhAccountAmount > 0.005) {
    const tawidh = bucketAccounts.TAWIDH_ACCOUNT;
    rows.push({
      no: rowNo++,
      nameOfPayee: tawidh.displayName || "Ta'widh",
      accountNo: tawidh.accountNumber,
      banker: tawidh.bankName,
      amount: input.tawidhAccountAmount,
      remarks: "Ta'widh / late payment compensation",
    });
  }

  if (input.gharamahAmount > 0.005) {
    const gharamah = bucketAccounts.GHARAMAH_ACCOUNT;
    rows.push({
      no: rowNo++,
      nameOfPayee: gharamah.displayName || "Gharamah",
      accountNo: gharamah.accountNumber,
      banker: gharamah.bankName,
      amount: input.gharamahAmount,
      remarks: "Gharamah / penalty charge",
    });
  }

  if (input.issuerResidualAmount > 0.005) {
    const issuerSnapshot = asRecord(input.issuerBeneficiarySnapshot);
    const issuerAccountNumber = issuerSnapshot
      ? beneficiaryField(issuerSnapshot, "account_number")
      : "";
    const issuerBank = issuerSnapshot ? beneficiaryField(issuerSnapshot, "bank_name") : "";
    const issuerAccountHolder = issuerSnapshot
      ? beneficiaryField(issuerSnapshot, "account_holder")
      : "";

    if (issuerAccountNumber && issuerBank) {
      rows.push({
        no: rowNo++,
        nameOfPayee:
          issuerAccountHolder ||
          input.issuerOrganizationName ||
          "Residual refund to Issuer",
        accountNo: issuerAccountNumber,
        banker: issuerBank,
        amount: input.issuerResidualAmount,
        remarks: "Residual refund to Issuer",
      });
    } else {
      const issuerPayable = bucketAccounts.ISSUER_PAYABLE;
      rows.push({
        no: rowNo++,
        nameOfPayee: issuerPayable.displayName || "Residual refund to Issuer",
        accountNo: issuerPayable.accountNumber,
        banker: issuerPayable.bankName,
        amount: input.issuerResidualAmount,
        remarks: "Residual refund to Issuer",
      });
    }
  }

  const now = input.referenceDate ?? new Date();
  const supportingParagraph = buildRepaymentSupportingParagraph({
    borrowerEntries: input.borrowerEntries,
    repaymentAccountName: input.repaymentAccountName || debit.accountName || debit.displayName || "Repayment Pool",
    investorPoolAccountName: investorPool.accountName || investorPool.displayName || "Investor Pool",
    serviceFeeAccountNumber: operatingAccount.accountNumber || "—",
  });

  return {
    ourRef: buildOurRef(letterConfig.defaultLetterRefPrefix, input.settlementId.slice(-8).toUpperCase()),
    date: formatLetterDate(now),
    trusteeName: letterConfig.trusteeName,
    trusteeAddressLines: [
      letterConfig.trusteeAddressLine1,
      letterConfig.trusteeAddressLine2,
      letterConfig.trusteeAddressLine3 ?? "",
    ].filter(Boolean),
    attentionPerson: letterConfig.attentionPerson,
    platformDisplayName: letterConfig.platformDisplayName,
    instructionTitle: "Instruction of Payment",
    debitAccountNumber: debit.accountNumber,
    debitAccountName: debit.accountName || debit.displayName || "Repayment Pool Account",
    valueDate: resolveTrusteeValueDate(letterConfig.defaultValueDateBehavior, now),
    purpose: "Repayment to Investors and Platform",
    openingParagraph: OPENING_PARAGRAPH,
    paymentRows: rows,
    supportingParagraph,
    contactPerson: letterConfig.defaultContactPerson,
    enclosingDocuments: false,
    authorisedSignatoryLabel: letterConfig.authorisedSignatoryLabel,
  };
}

export function mapInvestorWithdrawalLetterData(input: {
  withdrawalId: string;
  amount: number;
  beneficiarySnapshot: Record<string, unknown>;
  investorOrganizationName: string | null;
  config: ResolvedTrusteeConfig;
  referenceDate?: Date;
}): TrusteeLetterData {
  const { letterConfig, bucketAccounts } = input.config;
  const debit = bucketAccounts.INVESTOR_POOL;
  const snapshot = input.beneficiarySnapshot;
  const now = input.referenceDate ?? new Date();

  const rows: TrusteePaymentRow[] = [
    {
      no: 1,
      nameOfPayee: "Withdrawal requested by Investor",
      accountNo: beneficiaryField(snapshot, "account_number"),
      banker: beneficiaryField(snapshot, "bank_name"),
      amount: input.amount,
      remarks:
        beneficiaryField(snapshot, "account_holder") ||
        input.investorOrganizationName ||
        "Withdrawal requested by Investor",
    },
  ];

  return {
    ourRef: buildOurRef(letterConfig.defaultLetterRefPrefix, input.withdrawalId.slice(-8).toUpperCase()),
    date: formatLetterDate(now),
    trusteeName: letterConfig.trusteeName,
    trusteeAddressLines: [
      letterConfig.trusteeAddressLine1,
      letterConfig.trusteeAddressLine2,
      letterConfig.trusteeAddressLine3 ?? "",
    ].filter(Boolean),
    attentionPerson: letterConfig.attentionPerson,
    platformDisplayName: letterConfig.platformDisplayName,
    instructionTitle: "Instruction of Payment",
    debitAccountNumber: debit.accountNumber,
    debitAccountName: debit.accountName || debit.displayName || "Investor Pool Account",
    valueDate: resolveTrusteeValueDate(letterConfig.defaultValueDateBehavior, now),
    purpose: "Withdrawal by Investors",
    openingParagraph: OPENING_PARAGRAPH,
    paymentRows: rows,
    supportingParagraph: "",
    contactPerson: letterConfig.defaultContactPerson,
    enclosingDocuments: true,
    authorisedSignatoryLabel: letterConfig.authorisedSignatoryLabel,
  };
}

export function buildRepaymentBorrowerEntries(input: {
  payerName: string | null;
  receiptAmount: number;
  receiptDate: Date;
}): RepaymentBorrowerEntry[] {
  if (!input.payerName?.trim()) return [];
  return [
    {
      name: input.payerName.trim(),
      amount: input.receiptAmount,
      date: formatShortDate(input.receiptDate),
    },
  ];
}

export { asRecord, numberFromMeta, beneficiaryField };
