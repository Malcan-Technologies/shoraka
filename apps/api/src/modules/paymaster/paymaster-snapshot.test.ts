import { buildPaymasterSnapshot } from "./snapshot";
import { buildApplicationRevisionSnapshot } from "../applications/revision-snapshot";

describe("Paymaster snapshot compatibility", () => {
  const paymaster = {
    id: "pm_1",
    legal_name: "ABC Trading Sdn Bhd",
    registration_number: "202134567890",
    registration_country: "MY",
    entity_type: "Private Limited Company (Sdn Bhd)",
  };

  it("freezes customer identity without coupling verification status", () => {
    const snapshot = buildPaymasterSnapshot({
      paymaster,
      isRelatedParty: true,
      isLargePrivateCompany: true,
    });
    expect(snapshot).toEqual({
      name: "ABC Trading Sdn Bhd",
      entity_type: "Private Limited Company (Sdn Bhd)",
      ssm_number: "202134567890",
      country: "MY",
      is_related_party: true,
      is_large_private_company: true,
      paymaster_id: "pm_1",
    });
    expect(snapshot).not.toHaveProperty("verification_status");
    expect(snapshot).not.toHaveProperty("verified_at");
  });

  it("keeps application revision contract customer_details as a stored snapshot", () => {
    const contract = {
      id: "ctr_1",
      customer_details: {
        name: "ABC Trading Sdn Bhd",
        ssm_number: "202134567890",
        country: "MY",
        entity_type: "Private Limited Company (Sdn Bhd)",
        is_related_party: false,
        paymaster_id: "pm_1",
      },
    };
    const snapshot = buildApplicationRevisionSnapshot({
      financing_type: null,
      product_version: 1,
      financing_structure: null,
      company_details: null,
      business_details: null,
      financial_statements: null,
      supporting_documents: null,
      declarations: null,
      review_and_submit: null,
      last_completed_step: 3,
      contract_id: "ctr_1",
      contract,
      invoices: [],
      issuer_organization: null,
    });
    expect(snapshot).toMatchObject({
      contract,
    });
    const stored = (snapshot as { contract: typeof contract }).contract.customer_details;
    expect(stored.name).toBe("ABC Trading Sdn Bhd");
    expect(stored).not.toHaveProperty("verification_status");
  });
});
