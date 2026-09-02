import {
  collectLinkedApplicationIdentitySources,
  collectLinkedPaymasterApplications,
  paymasterApplicationProductType,
  productIdFromFinancingType,
  selectSubmittedApplicationIdentities,
  submittedIdentityFingerprint,
  type LinkedPaymasterContract,
} from "./submitted-application-identities";

const master = {
  legal_name: "ABC Trading Sdn Bhd",
  entity_type: "Private Limited Company (Sdn Bhd)",
  registration_country: "MY",
  registration_number: "202134567890",
};

function source(overrides: {
  applicationId: string;
  applicationDisplayReference?: string | null;
  submittedAt?: string | null;
  updatedAt?: string | null;
  issuerName?: string | null;
  financingStructure?: unknown;
  name: string;
  entityType?: string;
  country?: string;
  ssm?: string;
}) {
  return {
    applicationId: overrides.applicationId,
    applicationDisplayReference: overrides.applicationDisplayReference ?? overrides.applicationId,
    applicationProductId: "prod-1",
    applicationStatus: "SUBMITTED",
    submittedAt: overrides.submittedAt ?? "2026-09-01T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-09-03T00:00:00.000Z",
    issuerOrganizationId: "org-1",
    issuerName: overrides.issuerName ?? "Issuer One",
    financingStructure: overrides.financingStructure ?? { structure_type: "new_contract" },
    customerDetails: {
      name: overrides.name,
      entity_type: overrides.entityType ?? "Private Limited Company (Sdn Bhd)",
      ssm_number: overrides.ssm ?? master.registration_number,
      country: overrides.country ?? "MY",
    },
  };
}

function contractApp(overrides: {
  id: string;
  display_reference?: string | null;
  status?: string;
  submitted_at?: Date | null;
  updated_at?: Date;
  structure_type?: string;
  product_id?: string;
}): LinkedPaymasterContract["applications"][number] {
  return {
    id: overrides.id,
    display_reference: overrides.display_reference ?? overrides.id,
    status: overrides.status ?? "SUBMITTED",
    submitted_at: overrides.submitted_at ?? new Date("2026-09-01T00:00:00.000Z"),
    updated_at: overrides.updated_at ?? new Date("2026-09-03T00:00:00.000Z"),
    financing_type: { product_id: overrides.product_id ?? "prod-1" },
    financing_structure: { structure_type: overrides.structure_type ?? "new_contract" },
  };
}

describe("selectSubmittedApplicationIdentities", () => {
  it("lists matching identities so Admin can still open every application", () => {
    const rows = selectSubmittedApplicationIdentities({
      master,
      sources: [
        source({ applicationId: "app-1", applicationDisplayReference: "APP-001", name: "ABC Trading Sdn Bhd" }),
        source({ applicationId: "app-2", applicationDisplayReference: "APP-002", name: "ABC Trading Sdn Bhd" }),
      ],
    });
    expect(rows.map((row) => row.applicationDisplayReference)).toEqual(["APP-001", "APP-002"]);
    expect(rows.every((row) => row.legalName === "ABC Trading Sdn Bhd")).toBe(true);
  });

  it("keeps one row per application when submitted identities match each other", () => {
    const rows = selectSubmittedApplicationIdentities({
      master,
      sources: [
        source({
          applicationId: "app-1",
          applicationDisplayReference: "APP-001",
          name: "Wrong Name Sdn Bhd",
          submittedAt: "2026-08-02T00:00:00.000Z",
        }),
        source({
          applicationId: "app-2",
          applicationDisplayReference: "APP-002",
          name: "Wrong Name Sdn Bhd",
          submittedAt: "2026-08-01T00:00:00.000Z",
        }),
      ],
    });
    expect(rows.map((row) => row.applicationDisplayReference)).toEqual(["APP-001", "APP-002"]);
  });

  it("lists distinct submitted identities including the master-matching application", () => {
    const rows = selectSubmittedApplicationIdentities({
      master,
      sources: [
        source({
          applicationId: "app-1",
          applicationDisplayReference: "APP-001",
          name: "ABC Trading Sdn Bhd",
          submittedAt: "2026-08-01T00:00:00.000Z",
        }),
        source({
          applicationId: "app-2",
          applicationDisplayReference: "APP-002",
          name: "ABC Trading Malaysia Sdn Bhd",
          entityType: "Partnership",
          submittedAt: "2026-08-02T00:00:00.000Z",
        }),
      ],
    });
    expect(rows.map((row) => row.applicationDisplayReference)).toEqual(["APP-002", "APP-001"]);
    expect(rows[0]).toMatchObject({
      legalName: "ABC Trading Malaysia Sdn Bhd",
      entityType: "Partnership",
    });
    expect(rows[1]).toMatchObject({
      legalName: "ABC Trading Sdn Bhd",
      entityType: "Private Limited Company (Sdn Bhd)",
    });
  });

  it("dedupes the same application appearing twice on a contract", () => {
    const duplicate = source({
      applicationId: "app-1",
      name: "Other Co Sdn Bhd",
    });
    const rows = selectSubmittedApplicationIdentities({
      master,
      sources: [duplicate, duplicate],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.applicationId).toBe("app-1");
  });

  it("ignores submitted identities for a different SSM", () => {
    expect(
      selectSubmittedApplicationIdentities({
        master,
        sources: [
          source({
            applicationId: "app-1",
            name: "Other Co",
            ssm: "202201234567",
          }),
        ],
      })
    ).toEqual([]);
  });

  it("returns an empty list when there are no parseable identities", () => {
    expect(selectSubmittedApplicationIdentities({ master, sources: [] })).toEqual([]);
  });
});

describe("collectLinkedPaymasterApplications", () => {
  it("includes facility and invoice-only applications as unique rows", () => {
    const contracts: LinkedPaymasterContract[] = [
      {
        issuer_organization_id: "org-1",
        customer_details: { name: "ABC Trading Sdn Bhd" },
        issuer_organization: { name: "Toyota" },
        originating_application: null,
        applications: [
          contractApp({
            id: "app-facility",
            display_reference: "APP-ARF-202609-2AS",
            structure_type: "new_contract",
            status: "CONTRACT_SENT",
          }),
        ],
      },
      {
        issuer_organization_id: "org-2",
        customer_details: { name: "ABC Trading Sdn Bhd" },
        issuer_organization: { name: "ABC Sdn Bhd" },
        originating_application: null,
        applications: [
          contractApp({
            id: "app-invoice",
            display_reference: "APP-INV-202609-XYZ",
            structure_type: "invoice_only",
            status: "SUBMITTED",
            product_id: "prod-inv",
          }),
        ],
      },
    ];

    const rows = collectLinkedPaymasterApplications(contracts);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.reference)).toEqual([
      "APP-ARF-202609-2AS",
      "APP-INV-202609-XYZ",
    ]);
    expect(rows[0]).toMatchObject({
      id: "app-facility",
      issuerName: "Toyota",
      productType: "Facility financing",
      status: "CONTRACT_SENT",
      productId: "prod-1",
    });
    expect(rows[1]).toMatchObject({
      id: "app-invoice",
      issuerName: "ABC Sdn Bhd",
      productType: "Invoice financing",
      status: "SUBMITTED",
      productId: "prod-inv",
    });
  });

  it("does not require a facility record for invoice-only applications", () => {
    const rows = collectLinkedPaymasterApplications([
      {
        issuer_organization_id: "org-2",
        customer_details: { name: "ABC Trading Sdn Bhd" },
        issuer_organization: { name: "ABC Sdn Bhd" },
        originating_application: null,
        applications: [
          contractApp({
            id: "app-invoice",
            display_reference: "APP-INV-1",
            structure_type: "invoice_only",
          }),
        ],
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.productType).toBe("Invoice financing");
    expect(rows[0]?.id).toBe("app-invoice");
  });

  it("dedupes originating_application and applications joins for the same application", () => {
    const application = contractApp({
      id: "app-1",
      display_reference: "APP-001",
      structure_type: "existing_contract",
    });
    const rows = collectLinkedPaymasterApplications([
      {
        issuer_organization_id: "org-1",
        customer_details: {},
        issuer_organization: { name: "Toyota" },
        originating_application: application,
        applications: [application],
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("app-1");
    expect(rows[0]?.productType).toBe("Facility financing");
  });
});

describe("collectLinkedApplicationIdentitySources", () => {
  it("walks originating and linked applications on the holder or facility contract", () => {
    const sources = collectLinkedApplicationIdentitySources([
      {
        issuer_organization_id: "org-1",
        customer_details: { name: "ABC Trading Sdn Bhd", ssm_number: master.registration_number },
        issuer_organization: { name: "Toyota" },
        originating_application: contractApp({ id: "app-origin", display_reference: "APP-ORIGIN" }),
        applications: [contractApp({ id: "app-draw", display_reference: "APP-DRAW" })],
      },
    ]);
    expect(sources.map((sourceRow) => sourceRow.applicationId)).toEqual(["app-origin", "app-draw"]);
  });
});

describe("paymasterApplicationProductType", () => {
  it("uses Admin applications-list labels", () => {
    expect(paymasterApplicationProductType({ structure_type: "invoice_only" }, true)).toBe(
      "Invoice financing"
    );
    expect(paymasterApplicationProductType({ structure_type: "new_contract" }, false)).toBe(
      "Facility financing"
    );
    expect(paymasterApplicationProductType({ structure_type: "existing_contract" }, true)).toBe(
      "Facility financing"
    );
    expect(paymasterApplicationProductType(null, false)).toBe("Invoice financing");
  });
});

describe("submitted identity helpers", () => {
  it("reads product_id from financing_type JSON", () => {
    expect(productIdFromFinancingType({ product_id: "prod-9" })).toBe("prod-9");
    expect(productIdFromFinancingType(null)).toBeNull();
  });

  it("fingerprints identity without treating name as the Paymaster key", () => {
    const a = submittedIdentityFingerprint({
      legalName: "ABC Trading Sdn Bhd",
      registrationNumber: "202134567890",
      registrationCountry: "MY",
      entityType: "Private Limited Company (Sdn Bhd)",
    });
    const b = submittedIdentityFingerprint({
      legalName: "abc trading sdn bhd",
      registrationNumber: "202134567890",
      registrationCountry: "my",
      entityType: "private limited company (sdn bhd)",
    });
    expect(a).toBe(b);
  });
});
