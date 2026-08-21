import {
  buildFacilityLoMergeData,
  normalizeContractFacilityLoMergeData,
} from "./build-facility-lo-merge-data";
import { createFacilityLoFixture } from "./facility-lo-fixture";
import {
  buildFacilityLoRenderPayload,
  formatIndividualGuarantorLine,
  mapIndividualGuarantors,
  parseGuarantorsFromMergeInput,
} from "./facility-lo-guarantors";
import { numberToWords, formatRmAmount, daysPhrase } from "./lo-format";

describe("lo-format", () => {
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

describe("facility-lo guarantors", () => {
  it("maps all individual guarantors from application JSON", () => {
    const rows = mapIndividualGuarantors([
      { guarantor_type: "individual", name: "Ali", ic_number: "900101145678" },
      { guarantor_type: "individual", name: "Siti", ic_number: "880202085432" },
      { guarantor_type: "company", business_name: "HoldCo" },
      { guarantor_type: "individual", name: "Lee", ic_number: "770303123456" },
    ]);
    expect(rows).toHaveLength(3);
    expect(rows[0]?.line).toBe("Ali (NRIC No. 900101145678)");
    expect(rows[2]?.name).toBe("Lee");
  });

  it("parses guarantors_individual from demo POST bodies", () => {
    const rows = parseGuarantorsFromMergeInput({
      guarantors_individual: [
        { name: "Ali", nric: "900101145678", line: "Ali (NRIC No. 900101145678)" },
        { name: "Siti", nric: "", line: "" },
      ],
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]?.nric).toBe("900101145678");
    expect(rows[1]?.line).toBe("Siti");
  });

  it("adds page breaks between signature pages only", () => {
    const payload = buildFacilityLoRenderPayload(createFacilityLoFixture());
    const guarantors = payload.guarantors_individual as Array<{ page_break: string }>;
    expect(guarantors).toHaveLength(2);
    expect(guarantors[0]?.page_break).toContain('w:type="page"');
    expect(guarantors[1]?.page_break).toBe("");
    expect(payload.has_individual_guarantors).toBe(true);
    expect(payload.has_corporate_guarantor).toBe(false);
  });

  it("formats guarantor lines without NRIC", () => {
    expect(formatIndividualGuarantorLine("Ali", "")).toBe("Ali");
  });
});

describe("buildFacilityLoMergeData", () => {
  it("prefills EXISTS fields from contract + org + application", () => {
    const data = buildFacilityLoMergeData({
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
    expect(data.guarantors_individual).toHaveLength(1);
    expect(data.guarantors_individual[0]?.line).toContain("Ali");
    expect(data.guarantors_individual[0]?.name).toBe("Ali");
    expect(data.corporate_guarantor_name).toBe("HoldCo");
    expect(data.corporate_guarantor_ssm).toBe("999999-X");
    expect(data.assigned_contract_counterparty).toBe("Buyer Co");
    expect(data.assigned_contract_description).toBe("Supply Agreement");
    expect(data.grace_period_days).toBe("7");
    expect(data.grace_period_days_words).toBe("seven");
    expect(data.tenure_days).toBe("");
    expect(data.max_invoice_tenure_days).toBe("");
    expect(data.sub_limit_per_invoice_rm).toBe("");
    expect(data.part_b_financing_amount_rm).toBe("");
    expect(data.payment_period_days).toBe("");
  });
});

describe("normalizeContractFacilityLoMergeData", () => {
  it("fills from fixture then overlays posted strings", () => {
    const fixture = createFacilityLoFixture();
    const normalized = normalizeContractFacilityLoMergeData({
      issuer_name: "Override Name",
      tenure_days: "90",
    });
    expect(normalized.issuer_name).toBe("Override Name");
    expect(normalized.tenure_days).toBe("90");
    expect(normalized.our_reference).toBe(fixture.our_reference);
    expect(normalized.guarantors_individual).toHaveLength(2);
  });

  it("accepts guarantors_individual arrays from demo POST bodies", () => {
    const normalized = normalizeContractFacilityLoMergeData({
      guarantors_individual: [{ name: "Only One", nric: "123", line: "Only One (NRIC No. 123)" }],
    });
    expect(normalized.guarantors_individual).toEqual([
      { name: "Only One", nric: "123", line: "Only One (NRIC No. 123)" },
    ]);
  });
});
