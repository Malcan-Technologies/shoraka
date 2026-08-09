import {
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
