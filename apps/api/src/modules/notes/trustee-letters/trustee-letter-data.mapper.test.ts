import {
  buildRepaymentBorrowerEntries,
  mapDisbursementLetterData,
  mapInvestorWithdrawalLetterData,
  mapRepaymentLetterData,
} from "./trustee-letter-data.mapper";
import type { ResolvedTrusteeConfig } from "./trustee-letter-config.loader";

function buildConfig(): ResolvedTrusteeConfig {
  return {
    letterConfig: {
      trusteeName: "Trustee",
      trusteeAddressLine1: "Line 1",
      trusteeAddressLine2: "Line 2",
      attentionPerson: "Ops",
      defaultContactPerson: "Contact",
      authorisedSignatoryLabel: "Authorized",
      platformDisplayName: "CashSouk",
    },
    bucketAccounts: {
      INVESTOR_POOL: {
        displayName: "Investor Pool",
        bankName: "Bank",
        accountName: "Investor Pool",
        accountNumber: "111",
        remarks: "",
      },
      REPAYMENT_POOL: {
        displayName: "Repayment Pool",
        bankName: "Bank",
        accountName: "Repayment Pool",
        accountNumber: "222",
        remarks: "",
      },
      OPERATING_ACCOUNT: {
        displayName: "Operating",
        bankName: "Bank",
        accountName: "Operating",
        accountNumber: "333",
        remarks: "",
      },
      ISSUER_PAYABLE: {
        displayName: "Issuer Payable",
        bankName: "Bank",
        accountName: "Issuer Payable",
        accountNumber: "444",
        remarks: "",
      },
      TAWIDH_ACCOUNT: {
        displayName: "Tawidh",
        bankName: "Bank",
        accountName: "Tawidh",
        accountNumber: "555",
        remarks: "",
      },
      GHARAMAH_ACCOUNT: {
        displayName: "Gharamah",
        bankName: "Bank",
        accountName: "Gharamah",
        accountNumber: "666",
        remarks: "",
      },
    },
  };
}

describe("trustee-letter data mappers ourRef", () => {
  it("maps WDL ourRef for disbursement and investor withdrawal", () => {
    const config = buildConfig();
    const disbursement = mapDisbursementLetterData({
      ourRef: "WDL-ARF-202608-P30",
      withdrawalId: "wd_1",
      withdrawalAmount: 1000,
      beneficiarySnapshot: {},
      metadata: null,
      config,
    });
    const investorWithdrawal = mapInvestorWithdrawalLetterData({
      ourRef: "WDL-ARF-202608-X91",
      withdrawalId: "wd_2",
      amount: 500,
      beneficiarySnapshot: {},
      investorOrganizationName: "Investor",
      config,
    });

    expect(disbursement.ourRef).toBe("WDL-ARF-202608-P30");
    expect(investorWithdrawal.ourRef).toBe("WDL-ARF-202608-X91");
  });

  it("maps account-scoped WDL ourRef for investor withdrawal", () => {
    const config = buildConfig();
    const investorWithdrawal = mapInvestorWithdrawalLetterData({
      ourRef: "WDL-202608-X7A",
      withdrawalId: "wd_account",
      amount: 500,
      beneficiarySnapshot: {},
      investorOrganizationName: "Investor",
      config,
    });

    expect(investorWithdrawal.ourRef).toBe("WDL-202608-X7A");
  });

  it("maps SET ourRef for repayment letters", () => {
    const config = buildConfig();
    const repayment = mapRepaymentLetterData({
      ourRef: "SET-ARF-202608-A52",
      settlementId: "set_1",
      investorPrincipal: 500,
      investorProfitNet: 20,
      tawidhInvestorAmount: 0,
      serviceFeeAmount: 5,
      tawidhAccountAmount: 0,
      gharamahAmount: 0,
      issuerResidualAmount: 0,
      borrowerEntries: [],
      repaymentAccountName: "Repayment Pool",
      config,
    });

    expect(repayment.ourRef).toBe("SET-ARF-202608-A52");
  });
});

describe("mapDisbursementLetterData fee rows", () => {
  const beneficiary = {
    account_holder: "Issuer Sdn Bhd",
    account_number: "999",
    bank_name: "Maybank",
  };

  it("labels the stored platform fee as Drawdown Fee to Platform", () => {
    const letter = mapDisbursementLetterData({
      withdrawalId: "wd_fee",
      withdrawalAmount: 94_700,
      beneficiarySnapshot: beneficiary,
      metadata: {
        platformFeeAmount: 3_000,
        facilityFeeCharged: 800,
        netIssuerDisbursement: 94_700,
      },
      config: buildConfig(),
    });
    expect(letter.paymentRows.map((row) => row.remarks)).toEqual([
      "Disbursement to Borrower",
      "Drawdown Fee to Platform",
      "Facility Fee to Platform",
    ]);
    expect(letter.paymentRows[1]).toMatchObject({ amount: 3_000, accountNo: "333" });
  });

  it("appends validated additional fees in stored order and skips nonpositive or unsafe names", () => {
    const letter = mapDisbursementLetterData({
      withdrawalId: "wd_extra",
      withdrawalAmount: 90_000,
      beneficiarySnapshot: beneficiary,
      metadata: {
        platformFeeAmount: 2_000,
        facilityFeeCharged: 0,
        netIssuerDisbursement: 90_000,
        additionalFees: [
          { name: "Legal fee", kind: "amount", value: 500, chargedAmount: 500 },
          { name: "   ", kind: "amount", value: 10, chargedAmount: 10 },
          { name: "Arrangement", kind: "percent_of_funded", value: 1, chargedAmount: 800 },
          { name: "Zeroed", kind: "amount", value: 0, chargedAmount: 0 },
          { name: "Skip kind", kind: "nope", value: 1, chargedAmount: 25 },
          { name: "Stamp duty", kind: "amount", value: 50, chargedAmount: 50 },
        ],
      },
      config: buildConfig(),
    });
    expect(letter.paymentRows.map((row) => row.remarks)).toEqual([
      "Disbursement to Borrower",
      "Drawdown Fee to Platform",
      "Legal fee to Platform",
      "Arrangement to Platform",
      "Stamp duty to Platform",
    ]);
    expect(letter.paymentRows.map((row) => row.amount)).toEqual([90_000, 2_000, 500, 800, 50]);
    expect(letter.paymentRows.slice(2).every((row) => row.accountNo === "333")).toBe(true);
  });

  it("does not print the bucket label as Account Name when bank details are empty", () => {
    const config = buildConfig();
    config.bucketAccounts.INVESTOR_POOL = {
      displayName: "Investor Pool",
      bankName: "",
      accountName: "",
      accountNumber: "",
      remarks: "",
    };
    config.bucketAccounts.OPERATING_ACCOUNT = {
      displayName: "Operating Account",
      bankName: "",
      accountName: "",
      accountNumber: "",
      remarks: "",
    };
    const letter = mapDisbursementLetterData({
      withdrawalId: "wd_empty_pool",
      withdrawalAmount: 6_000,
      beneficiarySnapshot: {
        account_holder: "Toyota",
        account_number: "1111111111",
        bank_name: "Maybank / Malayan Banking Berhad",
      },
      metadata: { platformFeeAmount: 100, netIssuerDisbursement: 6_000 },
      config,
    });
    expect(letter.debitAccountName).toBe("");
    expect(letter.debitAccountNumber).toBe("");
    expect(letter.paymentRows[1]).toMatchObject({
      nameOfPayee: "—",
      accountNo: "—",
      banker: "—",
    });
  });
});

describe("trustee-letter Malaysia dates", () => {
  const afterMytMidnight = new Date("2026-09-01T16:00:00.000Z");
  const beforeMytMidnight = new Date("2026-09-01T15:59:59.000Z");

  it("prints Date and Value Date as the same Malaysia calendar day", () => {
    const config = buildConfig();
    const disbursement = mapDisbursementLetterData({
      withdrawalId: "wd_date",
      withdrawalAmount: 1000,
      beneficiarySnapshot: {},
      metadata: null,
      config,
      referenceDate: afterMytMidnight,
    });
    const repayment = mapRepaymentLetterData({
      settlementId: "set_date",
      investorPrincipal: 500,
      investorProfitNet: 0,
      tawidhInvestorAmount: 0,
      serviceFeeAmount: 0,
      tawidhAccountAmount: 0,
      gharamahAmount: 0,
      issuerResidualAmount: 0,
      borrowerEntries: [],
      repaymentAccountName: "Repayment Pool",
      config,
      referenceDate: afterMytMidnight,
    });
    const investorWithdrawal = mapInvestorWithdrawalLetterData({
      withdrawalId: "wd_inv_date",
      amount: 500,
      beneficiarySnapshot: {},
      investorOrganizationName: "Investor",
      config,
      referenceDate: afterMytMidnight,
    });

    expect(disbursement.date).toBe("2 September 2026");
    expect(disbursement.valueDate).toBe(disbursement.date);
    expect(repayment.date).toBe("2 September 2026");
    expect(repayment.valueDate).toBe(repayment.date);
    expect(investorWithdrawal.date).toBe("2 September 2026");
    expect(investorWithdrawal.valueDate).toBe(investorWithdrawal.date);
  });

  it("keeps the Malaysia calendar day across UTC midnight", () => {
    const letter = mapDisbursementLetterData({
      withdrawalId: "wd_tz",
      withdrawalAmount: 1000,
      beneficiarySnapshot: {},
      metadata: null,
      config: buildConfig(),
      referenceDate: beforeMytMidnight,
    });
    expect(letter.date).toBe("1 September 2026");
    expect(letter.valueDate).toBe("1 September 2026");
  });

  it("formats repayment receipt dates in Malaysia time", () => {
    const entries = buildRepaymentBorrowerEntries({
      payerName: "Issuer Sdn Bhd",
      receiptAmount: 100,
      receiptDate: afterMytMidnight,
    });
    expect(entries[0]?.date).toBe("02 Sept 2026");
  });
});
