import {
  buildFacilityLoMergeData,
  facilityLoCheckboxGlyphs,
  normalizeContractFacilityLoMergeData,
} from "./build-facility-lo-merge-data";
import { createFacilityLoFixture } from "./facility-lo-fixture";
import {
  buildCorporateGuarantorPages,
  buildFacilityLoRenderPayload,
  formatIndividualGuarantorLine,
  mapCorporateGuarantors,
  mapIndividualGuarantors,
  pairSignatoryRows,
  parseCorporateGuarantorsFromMergeInput,
  parseGuarantorsFromMergeInput,
} from "./facility-lo-guarantors";
import { numberToWords, formatRmAmount, daysPhrase } from "./lo-format";
import {
  FACILITY_LO_CHECKBOX_TICKED,
  FACILITY_LO_CHECKBOX_UNTICKED,
} from "./facility-lo-merge.types";
import type { AuthorizedPartiesSnapshot } from "@cashsouk/types";
import { FINANCING_TENURE_MAX_DAYS } from "@cashsouk/types";

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

describe("facilityLoCheckboxGlyphs", () => {
  it("ticks Part A for new_contract", () => {
    expect(facilityLoCheckboxGlyphs("new_contract")).toEqual({
      part_a_checkbox: FACILITY_LO_CHECKBOX_TICKED,
      part_b_checkbox: FACILITY_LO_CHECKBOX_UNTICKED,
    });
  });

  it("ticks Part B for invoice_only and existing_contract", () => {
    expect(facilityLoCheckboxGlyphs("invoice_only").part_b_checkbox).toBe(FACILITY_LO_CHECKBOX_TICKED);
    expect(facilityLoCheckboxGlyphs("existing_contract").part_a_checkbox).toBe(
      FACILITY_LO_CHECKBOX_UNTICKED
    );
    expect(facilityLoCheckboxGlyphs("existing_contract").part_b_checkbox).toBe(
      FACILITY_LO_CHECKBOX_TICKED
    );
  });

  it("ticks neither when structure is missing", () => {
    expect(facilityLoCheckboxGlyphs(null)).toEqual({
      part_a_checkbox: FACILITY_LO_CHECKBOX_UNTICKED,
      part_b_checkbox: FACILITY_LO_CHECKBOX_UNTICKED,
    });
    expect(facilityLoCheckboxGlyphs(undefined)).toEqual({
      part_a_checkbox: FACILITY_LO_CHECKBOX_UNTICKED,
      part_b_checkbox: FACILITY_LO_CHECKBOX_UNTICKED,
    });
  });
});

describe("facility-lo guarantors", () => {
  it("maps all individual guarantors from ordered application_guarantors", () => {
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
    expect(rows[1]?.line).toBe("Siti (NRIC No. [INSERT])");
  });

  it("parses guarantors_corporate from demo POST bodies", () => {
    const rows = parseCorporateGuarantorsFromMergeInput({
      guarantors_corporate: [
        { name: "HoldCo", ssm: "999999-X", signatories: [{ name: "Nora" }, { name: "" }] },
      ],
    });
    expect(rows).toEqual([
      { name: "HoldCo", ssm: "999999-X", signatories: [{ name: "Nora", nric: "", capacity: "" }] },
    ]);
  });

  it("adds page breaks between individual pages and before corporate pages", () => {
    const payload = buildFacilityLoRenderPayload(createFacilityLoFixture());
    const guarantors = payload.guarantors_individual as Array<{ page_break: string }>;
    expect(guarantors).toHaveLength(2);
    expect(guarantors[0]?.page_break).toContain('w:type="page"');
    expect(guarantors[1]?.page_break).toContain('w:type="page"');
    expect(payload.has_individual_guarantors).toBe(true);
    expect(payload.has_corporate_guarantor).toBe(true);
    const corpPages = payload.corporate_guarantor_pages as Array<{ page_break: string }>;
    expect(corpPages.length).toBe(3);
    expect(corpPages[0]?.page_break).toContain('w:type="page"');
    expect(corpPages[2]?.page_break).toBe("");
  });

  it("omits the last individual page break when there is no corporate guarantor", () => {
    const fixture = createFacilityLoFixture();
    fixture.guarantors_corporate = [];
    const payload = buildFacilityLoRenderPayload(fixture);
    const guarantors = payload.guarantors_individual as Array<{ page_break: string }>;
    expect(guarantors[1]?.page_break).toBe("");
    expect(payload.has_corporate_guarantor).toBe(false);
  });

  it("keeps NRIC placeholder when NRIC is missing", () => {
    expect(formatIndividualGuarantorLine("Ali", "")).toBe("Ali (NRIC No. [INSERT])");
    expect(formatIndividualGuarantorLine("", "")).toBe("[INSERT NAME] (NRIC No. [INSERT])");
  });

  it("prints a visible placeholder line when Finance Documents has no guarantors", () => {
    const fixture = createFacilityLoFixture();
    fixture.guarantors_individual = [];
    fixture.guarantors_corporate = [];
    fixture.finance_documents_guarantors = [];
    const payload = buildFacilityLoRenderPayload(fixture);
    expect(payload.finance_documents_guarantors).toEqual([
      { line: "[INSERT NAME] (NRIC No. [INSERT])", representatives: [] },
    ]);
  });

  it("prints {tag} for empty scalar merge fields", () => {
    const fixture = createFacilityLoFixture();
    fixture.grace_period_days = "";
    fixture.attention_name = "";
    const payload = buildFacilityLoRenderPayload(fixture);
    expect(payload.grace_period_days).toBe("{grace_period_days}");
    expect(payload.attention_name).toBe("{attention_name}");
    expect(payload.issuer_name).toBe(fixture.issuer_name);
  });
});

describe("buildCorporateGuarantorPages", () => {
  function pagesFor(count: number) {
    const names = Array.from({ length: count }, (_, i) => ({
      name: `S${i + 1}`,
      nric: "",
      capacity: "",
    }));
    return buildCorporateGuarantorPages([{ name: "HoldCo", ssm: "1", signatories: names }]);
  }

  it("pairs 1 signatory onto one page with no right box", () => {
    const pages = pagesFor(1);
    expect(pages).toHaveLength(1);
    expect(pages[0]?.is_first_page).toBe(true);
    expect(pages[0]?.signatory_rows).toEqual([{ left_name: "S1", right_name: "", show_right: false }]);
  });

  it("pairs 2 signatories onto one row", () => {
    const pages = pagesFor(2);
    expect(pages).toHaveLength(1);
    expect(pages[0]?.signatory_rows).toEqual([{ left_name: "S1", right_name: "S2", show_right: true }]);
  });

  it("fits 4 signatories on one page", () => {
    const pages = pagesFor(4);
    expect(pages).toHaveLength(1);
    expect(pages[0]?.signatory_rows).toHaveLength(2);
  });

  it("splits 5 signatories into two pages with heading only on the first", () => {
    const pages = pagesFor(5);
    expect(pages).toHaveLength(2);
    expect(pages[0]?.is_first_page).toBe(true);
    expect(pages[0]?.signatory_rows).toHaveLength(2);
    expect(pages[1]?.is_first_page).toBe(false);
    expect(pages[1]?.signatory_rows).toEqual([{ left_name: "S5", right_name: "", show_right: false }]);
  });

  it("splits 9 signatories into three pages", () => {
    const pages = pagesFor(9);
    expect(pages).toHaveLength(3);
    expect(pages[2]?.signatory_rows).toEqual([{ left_name: "S9", right_name: "", show_right: false }]);
  });

  it("keeps a blank box when a company has zero signatories", () => {
    const pages = buildCorporateGuarantorPages([{ name: "HoldCo", ssm: "1", signatories: [] }]);
    expect(pages).toHaveLength(1);
    expect(pages[0]?.signatory_rows).toEqual([
      { left_name: "[INSERT NAME]", right_name: "", show_right: false },
    ]);
    expect(pairSignatoryRows([])).toEqual([
      { left_name: "[INSERT NAME]", right_name: "", show_right: false },
    ]);
  });
});

const TWO_CORP_SNAPSHOT: AuthorizedPartiesSnapshot = {
  submitted_by_user_id: "user_1",
  submitted_at: "2026-08-21T00:00:00.000Z",
  parties: [
    {
      key: "g_co",
      entity_kind: "CORPORATE_GUARANTOR",
      application_guarantor_id: "g_co",
      representatives: [
        {
          name: "Nora",
          email: "nora@holdco.my",
          ic_number: "880101015555",
          capacity: "authorised_signatory",
        },
        {
          name: "Farid",
          email: "farid@holdco.my",
          ic_number: "770202025555",
          capacity: "director",
        },
      ],
    },
    {
      key: "g_co2",
      entity_kind: "CORPORATE_GUARANTOR",
      application_guarantor_id: "g_co2",
      representatives: [
        {
          name: "Aini",
          email: "aini@two.my",
          ic_number: "660101015555",
          capacity: "director",
        },
      ],
    },
  ],
};

describe("mapCorporateGuarantors", () => {
  it("matches snapshot signatories onto every company guarantor", () => {
    const rows = mapCorporateGuarantors(
      [
        { guarantor_type: "company", id: "g_co", business_name: "HoldCo", ssm_number: "999999-X" },
        { guarantor_type: "company", id: "g_co2", business_name: "TwoCo", ssm_number: "888888-U" },
        { guarantor_type: "individual", name: "Ali", ic_number: "900101145678" },
      ],
      TWO_CORP_SNAPSHOT
    );
    expect(rows).toEqual([
      {
        name: "HoldCo",
        ssm: "999999-X",
        signatories: [
          { name: "Nora", nric: "880101015555", capacity: "authorised_signatory" },
          { name: "Farid", nric: "770202025555", capacity: "director" },
        ],
      },
      {
        name: "TwoCo",
        ssm: "888888-U",
        signatories: [{ name: "Aini", nric: "660101015555", capacity: "director" }],
      },
    ]);
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
        business_details: {},
        application_guarantors: [
          {
            id: "g_ind",
            guarantor_type: "individual",
            name: "Ali",
            ic_number: "900101145678",
          },
          {
            id: "g_co",
            guarantor_type: "company",
            business_name: "HoldCo",
            ssm_number: "999999-X",
          },
        ],
      },
      financingStructureType: "new_contract",
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
    expect(data.guarantors_corporate).toEqual([
      { name: "HoldCo", ssm: "999999-X", signatories: [] },
    ]);
    expect(data.part_a_checkbox).toBe(FACILITY_LO_CHECKBOX_TICKED);
    expect(data.part_b_checkbox).toBe(FACILITY_LO_CHECKBOX_UNTICKED);
    expect(data.assigned_contract_counterparty).toBe("Buyer Co");
    expect(data.assigned_contract_description).toBe("Supply Agreement");
    expect(data.grace_period_days).toBe("7");
    expect(data.grace_period_days_words).toBe("seven");
    expect(data.tenure_days).toBe(String(FINANCING_TENURE_MAX_DAYS));
    expect(data.max_invoice_tenure_days).toBe(String(FINANCING_TENURE_MAX_DAYS));
    expect(data.payment_period_days).toBe(String(FINANCING_TENURE_MAX_DAYS));
    expect(data.transaction_docs_days).toBe("14");
    expect(data.transaction_docs_days_words).toBe("fourteen");
    expect(data.sub_limit_per_invoice_rm).toBe("");
    expect(data.part_b_financing_amount_rm).toBe("");
    expect(data.finance_documents_guarantors).toEqual([
      { line: "Ali (NRIC No. 900101145678)", representatives: [] },
      { line: "HoldCo (Registration No. 999999-X)", representatives: [] },
    ]);
  });

  it("fills authorised signatory names from every declared person on the snapshot", () => {
    const data = buildFacilityLoMergeData({
      contract: {
        id: "ctr_abc",
        issuer_organization_id: "org_1",
        offer_details: {
          offered_facility: 500000,
          sent_at: "2026-07-16T02:00:00.000Z",
          offer_acceptance: {
            status: "APPROVED_FOR_SIGNING",
            authorized_parties: {
              submitted_by_user_id: "user_1",
              submitted_at: "2026-08-21T00:00:00.000Z",
              parties: [
                {
                  key: "issuer",
                  entity_kind: "ISSUER",
                  representatives: [
                    {
                      name: "Ali Bin Abu",
                      email: "ali@co.my",
                      ic_number: "820508105871",
                      capacity: "director",
                      person_match_key: "820508105871",
                    },
                    {
                      name: "Siti",
                      email: "siti@co.my",
                      ic_number: "900101015555",
                      capacity: "director",
                      person_match_key: "900101015555",
                    },
                  ],
                },
                {
                  key: "g_co",
                  entity_kind: "CORPORATE_GUARANTOR",
                  application_guarantor_id: "g_co",
                  representatives: [
                    {
                      name: "Nora",
                      email: "nora@holdco.my",
                      ic_number: "880101015555",
                      capacity: "authorised_signatory",
                    },
                    {
                      name: "Farid",
                      email: "farid@holdco.my",
                      ic_number: "770202025555",
                      capacity: "director",
                    },
                  ],
                },
                {
                  key: "g_co2",
                  entity_kind: "CORPORATE_GUARANTOR",
                  application_guarantor_id: "g_co2",
                  representatives: [
                    {
                      name: "Aini",
                      email: "aini@two.my",
                      ic_number: "660101015555",
                      capacity: "director",
                    },
                  ],
                },
              ],
            },
          },
        },
        contract_details: {},
        customer_details: {},
      },
      issuerOrganization: {
        id: "org_1",
        name: "Issuer Co",
      },
      application: {
        id: "app_1",
        application_guarantors: [
          { id: "g_co", guarantor_type: "company", business_name: "HoldCo", ssm_number: "999999-X" },
          { id: "g_co2", guarantor_type: "company", business_name: "TwoCo", ssm_number: "888888-U" },
        ],
      },
      financingStructureType: "invoice_only",
    });
    expect(data.guarantors_corporate).toEqual([
      {
        name: "HoldCo",
        ssm: "999999-X",
        signatories: [
          { name: "Nora", nric: "880101015555", capacity: "authorised_signatory" },
          { name: "Farid", nric: "770202025555", capacity: "director" },
        ],
      },
      {
        name: "TwoCo",
        ssm: "888888-U",
        signatories: [{ name: "Aini", nric: "660101015555", capacity: "director" }],
      },
    ]);
    expect(data.part_a_checkbox).toBe(FACILITY_LO_CHECKBOX_UNTICKED);
    expect(data.part_b_checkbox).toBe(FACILITY_LO_CHECKBOX_TICKED);
  });

  it("leaves both facility-type boxes unticked when structure is missing", () => {
    const data = buildFacilityLoMergeData({
      contract: {
        id: "ctr_abc",
        issuer_organization_id: "org_1",
        offer_details: { offered_facility: 1 },
        contract_details: {},
        customer_details: {},
      },
      issuerOrganization: { id: "org_1", name: "Issuer Co" },
    });
    expect(data.part_a_checkbox).toBe(FACILITY_LO_CHECKBOX_UNTICKED);
    expect(data.part_b_checkbox).toBe(FACILITY_LO_CHECKBOX_UNTICKED);
  });

  it("falls back to COD ssmRegistrationNumber then ssmRegisterNumber", () => {
    const toyota = buildFacilityLoMergeData({
      contract: {
        id: "ctr_abc",
        issuer_organization_id: "org_1",
        offer_details: { offered_facility: 1, sent_at: "2026-07-16T02:00:00.000Z" },
        contract_details: {},
        customer_details: {},
      },
      issuerOrganization: {
        id: "org_1",
        name: "Toyota Legacy",
        registration_number: "",
        corporate_onboarding_data: {
          basicInfo: { ssmRegistrationNumber: "123412341234" },
        },
      },
    });
    expect(toyota.issuer_registration_number).toBe("123412341234");

    const alias = buildFacilityLoMergeData({
      contract: {
        id: "ctr_abc",
        issuer_organization_id: "org_1",
        offer_details: { offered_facility: 1, sent_at: "2026-07-16T02:00:00.000Z" },
        contract_details: {},
        customer_details: {},
      },
      issuerOrganization: {
        id: "org_1",
        name: "Alias Co",
        corporate_onboarding_data: {
          basicInfo: { ssmRegisterNumber: "555555555555" },
        },
      },
    });
    expect(alias.issuer_registration_number).toBe("555555555555");
  });

  it("reads signing_deadline.days and invoice sub-limit from the frozen product workflow", () => {
    const data = buildFacilityLoMergeData({
      contract: {
        id: "ctr_abc",
        issuer_organization_id: "org_1",
        offer_details: {
          offered_facility: 500000,
          sent_at: "2026-07-16T16:00:00.000Z",
          offer_acceptance: {
            status: "PENDING_ISSUER",
            acceptance_expires_at: "2026-07-23T16:00:00.000Z",
          },
        },
        contract_details: {},
        customer_details: {},
      },
      issuerOrganization: { id: "org_1", name: "Issuer Co", registration_number: "123456-A" },
      productWorkflow: [
        {
          id: "financing_type",
          config: { signing_deadline: { days: 14, reminders: [] } },
        },
        {
          id: "invoice_details",
          config: { sub_limit_per_invoice_rm: 250000 },
        },
      ],
    });
    expect(data.transaction_docs_days).toBe("14");
    expect(data.transaction_docs_days_words).toBe("fourteen");
    expect(data.sub_limit_per_invoice_rm).toBe("RM 250,000.00");
    expect(data.part_b_financing_amount_rm).toBe("RM 250,000.00");
    expect(data.offer_validity_phrase).toBe("seven (7) days");
  });

  it("matches corporate representatives from the authorised-parties draft", () => {
    const data = buildFacilityLoMergeData({
      contract: {
        id: "ctr_abc",
        issuer_organization_id: "org_1",
        offer_details: {
          offered_facility: 1,
          sent_at: "2026-07-16T02:00:00.000Z",
          offer_acceptance: {
            status: "PENDING_ISSUER",
            authorized_parties_draft: TWO_CORP_SNAPSHOT,
          },
        },
        contract_details: {},
        customer_details: {},
      },
      issuerOrganization: { id: "org_1", name: "Issuer Co" },
      application: {
        id: "app_1",
        application_guarantors: [
          { id: "g_co", guarantor_type: "company", business_name: "HoldCo", ssm_number: "999999-X" },
        ],
      },
    });
    expect(data.guarantors_corporate[0]?.signatories).toEqual([
      { name: "Nora", nric: "880101015555", capacity: "authorised_signatory" },
      { name: "Farid", nric: "770202025555", capacity: "director" },
    ]);
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
    expect(normalized.guarantors_corporate).toHaveLength(2);
  });

  it("accepts guarantors arrays from demo POST bodies", () => {
    const normalized = normalizeContractFacilityLoMergeData({
      guarantors_individual: [{ name: "Only One", nric: "123", line: "Only One (NRIC No. 123)" }],
      guarantors_corporate: [{ name: "Only Co", ssm: "1", signatories: [{ name: "Pat" }] }],
    });
    expect(normalized.guarantors_individual).toEqual([
      { name: "Only One", nric: "123", line: "Only One (NRIC No. 123)" },
    ]);
    expect(normalized.guarantors_corporate).toEqual([
      { name: "Only Co", ssm: "1", signatories: [{ name: "Pat", nric: "", capacity: "" }] },
    ]);
  });
});
