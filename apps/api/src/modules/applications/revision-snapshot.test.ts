import { buildApplicationRevisionSnapshot } from "./revision-snapshot";

describe("buildApplicationRevisionSnapshot", () => {
  it("flattens application_guarantors into snapshot guarantors", () => {
    const snapshot = buildApplicationRevisionSnapshot({
      financing_type: { product_id: "prod_001" },
      product_version: 3,
      amendment_acknowledged_workflow_ids: ["wf_1", 123 as unknown as string],
      financing_structure: { type: "invoice" },
      company_details: { company_name: "Acme Sdn Bhd" },
      business_details: { turnover: "100000" },
      application_guarantors: [
        {
          id: "ag_1",
          client_guarantor_id: "g-individual-1",
          position: 0,
          guarantor_type: "individual",
          email: "first@example.com",
          name: "Jane Doe",
          ic_number: "900101101234",
          source_data: {
            guarantor_agreement: {
              s3_key: "agreements/x.pdf",
              file_name: "signed.pdf",
              file_size: 1200,
            },
          },
          aml_status: "Pending",
          aml_message_status: "PENDING",
          last_triggered_at: null,
          last_synced_at: null,
          updated_at: new Date("2024-01-01T00:00:00.000Z"),
        },
      ],
      financial_statements: { yearly: [] },
      supporting_documents: { docs: [] },
      declarations: { accepted: true },
      review_and_submit: { submitted: false },
      last_completed_step: 4,
      contract_id: null,
      contract: null,
      invoices: [{ id: "inv_1" }],
      issuer_organization: { id: "org_1" },
    });

    expect(snapshot).toMatchObject({
      product: { id: "prod_001", version: 3 },
      amendment_acknowledged_workflow_ids: ["wf_1"],
      application: {
        guarantors: [
          expect.objectContaining({
            id: "ag_1",
            client_guarantor_id: "g-individual-1",
            position: 0,
            aml_status: "Pending",
            email: "first@example.com",
            name: "Jane Doe",
            source_data: {
              guarantor_agreement: {
                s3_key: "agreements/x.pdf",
                file_name: "signed.pdf",
                file_size: 1200,
              },
            },
          }),
        ],
      },
      invoices: [{ id: "inv_1" }],
      issuer_organization: { id: "org_1" },
    });
  });

  it("falls back safely when application_guarantors is missing", () => {
    const snapshot = buildApplicationRevisionSnapshot({
      financing_type: null,
      product_version: null,
      amendment_acknowledged_workflow_ids: null,
      financing_structure: null,
      company_details: null,
      business_details: null,
      financial_statements: null,
      supporting_documents: null,
      declarations: null,
      review_and_submit: null,
      last_completed_step: 1,
      contract_id: null,
      contract: undefined,
      invoices: undefined,
      issuer_organization: undefined,
    });

    expect(snapshot).toMatchObject({
      amendment_acknowledged_workflow_ids: [],
      application: { guarantors: [] },
      invoices: [],
      contract: null,
      issuer_organization: null,
    });
  });
});
