import {
  productIdFromFinancingType,
  selectDifferingSubmittedApplicationIdentities,
  submittedIdentityFingerprint,
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
  issuerName?: string | null;
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
    issuerOrganizationId: "org-1",
    issuerName: overrides.issuerName ?? "Issuer One",
    customerDetails: {
      name: overrides.name,
      entity_type: overrides.entityType ?? "Private Limited Company (Sdn Bhd)",
      ssm_number: overrides.ssm ?? master.registration_number,
      country: overrides.country ?? "MY",
    },
  };
}

describe("selectDifferingSubmittedApplicationIdentities", () => {
  it("omits submitted identities that already match the current master", () => {
    expect(
      selectDifferingSubmittedApplicationIdentities({
        master,
        sources: [
          source({ applicationId: "app-1", name: "ABC Trading Sdn Bhd" }),
          source({ applicationId: "app-2", name: "ABC Trading Sdn Bhd" }),
        ],
      })
    ).toEqual([]);
  });

  it("shows one row when a single application differs from the master", () => {
    const rows = selectDifferingSubmittedApplicationIdentities({
      master,
      sources: [source({ applicationId: "app-9", applicationDisplayReference: "APP-009", name: "Other Co" })],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.applicationDisplayReference).toBe("APP-009");
    expect(rows[0]?.legalName).toBe("Other Co");
  });

  it("lists distinct submitted identities, including the master-matching one for comparison", () => {
    const rows = selectDifferingSubmittedApplicationIdentities({
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

  it("does not emit duplicate conflict rows for the same differing identity", () => {
    const rows = selectDifferingSubmittedApplicationIdentities({
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
    expect(rows).toHaveLength(1);
    expect(rows[0]?.applicationDisplayReference).toBe("APP-001");
  });

  it("dedupes the same application appearing twice on a contract", () => {
    const duplicate = source({
      applicationId: "app-1",
      name: "Other Co Sdn Bhd",
    });
    const rows = selectDifferingSubmittedApplicationIdentities({
      master,
      sources: [duplicate, duplicate],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.applicationId).toBe("app-1");
  });

  it("ignores submitted identities for a different SSM", () => {
    expect(
      selectDifferingSubmittedApplicationIdentities({
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
