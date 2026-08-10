import {
  buildContractLooMergeData,
  normalizeContractLooMergeData,
} from "./build-contract-loo-merge-data";
import { createContractLooFixture } from "./contract-loo-fixture";
import { numberToWords, formatRmAmount, daysPhrase } from "./loo-format";

describe("loo-format", () => {
  it("converts small numbers to words", () => {
    expect(numberToWords(7)).toBe("seven");
    expect(numberToWords(21)).toBe("twenty-one");
    expect(numberToWords(14)).toBe("fourteen");
  });

  it("formats RM amounts", () => {
    expect(formatRmAmount(1000000)).toBe("RM 1,000,000.00");
  });

  it("builds days phrases", () => {
    expect(daysPhrase(7)).toBe("seven (7) days");
  });
});

describe("buildContractLooMergeData", () => {
  it("prefills EXISTS fields from contract + org + application", () => {
    const data = buildContractLooMergeData({
      contract: {
        id: "ctr_abc",
        issuer_organization_id: "org_1",
        offer_details: {
          offered_facility: 500000,
          sent_at: "2026-07-16T02:00:00.000Z",
        },
        contract_details: {
          value: 1000000,
          start_date: "2026-01-01",
          title: "Supply Agreement",
        },
        customer_details: { name: "Buyer Co" },
      },
      issuerOrganization: {
        id: "org_1",
        name: "Issuer Co",
        registration_number: "123456-A",
        address: "Legacy address",
        corporate_onboarding_data: {
          addresses: {
            registered: {
              line1: "1 Jalan Test",
              city: "Kuala Lumpur",
              postcode: "50000",
              state: "Wilayah Persekutuan",
              country: "Malaysia",
            },
          },
        },
      },
      application: {
        id: "app_1",
        company_details: {
          contact_person: { name: "Contact", position: "CEO" },
        },
        business_details: {
          guarantors: [
            {
              guarantor_type: "individual",
              name: "Ali",
              ic_number: "900101145678",
            },
            {
              guarantor_type: "company",
              business_name: "HoldCo",
              ssm_number: "999999-X",
            },
          ],
        },
      },
      gracePeriodDaysDefault: 7,
    });

    expect(data.issuer_id).toBe("org_1");
    expect(data.our_reference).toBe("ctr_abc");
    expect(data.issuer_name).toBe("Issuer Co");
    expect(data.issuer_registration_number).toBe("123456-A");
    expect(data.issuer_address).toContain("1 Jalan Test");
    expect(data.attention_name).toBe("Contact");
    expect(data.attention_position).toBe("CEO");
    expect(data.financing_limit_rm).toBe("RM 500,000.00");
    expect(data.margin_of_receivable_percent).toBe("50");
    expect(data.guarantor_1_line).toContain("Ali");
    expect(data.guarantor_1_name).toBe("Ali");
    expect(data.corporate_guarantor_name).toBe("HoldCo");
    expect(data.corporate_guarantor_ssm).toBe("999999-X");
    expect(data.assigned_contract_counterparty).toBe("Buyer Co");
    expect(data.assigned_contract_description).toBe("Supply Agreement");
    expect(data.grace_period_days).toBe("7");
    expect(data.grace_period_days_words).toBe("seven");
    expect(data.withdrawal_notice_phrase).toContain("twenty-one");
    // MISSING commercial terms stay empty for form override
    expect(data.profit_rate_percent).toBe("");
    expect(data.tenure_days).toBe("");
    expect(data.payment_period_days).toBe("");
  });
});

describe("normalizeContractLooMergeData", () => {
  it("fills from fixture then overlays posted strings", () => {
    const fixture = createContractLooFixture();
    const normalized = normalizeContractLooMergeData({
      issuer_name: "Override Name",
      profit_rate_percent: "1.5",
    });
    expect(normalized.issuer_name).toBe("Override Name");
    expect(normalized.profit_rate_percent).toBe("1.5");
    expect(normalized.our_reference).toBe(fixture.our_reference);
  });
});
