jest.mock("../../lib/prisma", () => ({
  prisma: {},
}));

jest.mock("../applications/authorized-parties", () => {
  const actual = jest.requireActual("../applications/authorized-parties") as Record<string, unknown>;
  return {
    ...actual,
    loadIssuerDirectorPool: jest.fn(),
  };
});

import { InvoiceStatus } from "@cashsouk/types";
import { loadIssuerDirectorPool } from "../applications/authorized-parties";
import { SigningService } from "./service";
import type { SigningRepository } from "./repository";

const loadPool = loadIssuerDirectorPool as jest.MockedFunction<typeof loadIssuerDirectorPool>;

const FA_WORKFLOW = [
  {
    config: {
      signing_packages: {
        documents: [
          {
            key: "facility_agreement",
            name: "Facility Agreement",
            signer_role_keys: ["issuer_director"],
          },
        ],
        roles: [{ key: "issuer_director", label: "Issuer director" }],
      },
    },
  },
];

const invoiceOfferWithSealApplier = {
  offer_acceptance: {
    status: "APPROVED_FOR_SIGNING",
    authorized_parties: {
      submitted_by_user_id: "user-1",
      submitted_at: "2026-09-01T00:00:00.000Z",
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
              applies_company_seal: true,
            },
          ],
        },
      ],
    },
  },
};

function createService(repo: Partial<SigningRepository>) {
  return new SigningService({
    findOperatorDocumentExecutionBindings: jest.fn().mockResolvedValue([]),
    findOperatorCompanyStamp: jest.fn().mockResolvedValue(null),
    findActiveIssuerCompanySeal: jest.fn().mockResolvedValue({
      id: "seal_1",
      s3_key: "issuer-organizations/org-1/company-seals/a.png",
      sha256: "abc",
    }),
    ...repo,
  } as SigningRepository);
}

describe("getSigningPackageReadiness", () => {
  const previousSealFlag = process.env.SC_ENABLE_SEAL_FIELD;

  beforeEach(() => {
    delete process.env.SC_ENABLE_SEAL_FIELD;
    loadPool.mockReset();
    loadPool.mockResolvedValue([
      {
        matchKey: "820508105871",
        name: "Ali Bin Abu",
        email: "ali@co.my",
        icNumber: "820508105871",
      },
    ]);
  });

  afterEach(() => {
    if (previousSealFlag === undefined) delete process.env.SC_ENABLE_SEAL_FIELD;
    else process.env.SC_ENABLE_SEAL_FIELD = previousSealFlag;
  });

  it("does not require a seal applier from the holder contract on invoice-only apps", async () => {
    const service = createService({
      findApplicationContext: jest.fn().mockResolvedValue({
        id: "app-1",
        issuer_organization_id: "org-1",
        financing_structure: { structure_type: "invoice_only" },
        contract_id: "holder-1",
        contract: { id: "holder-1", offer_details: {} },
        invoices: [
          {
            id: "inv-1",
            status: InvoiceStatus.OFFER_SENT,
            offer_details: invoiceOfferWithSealApplier,
          },
        ],
      }),
    });
    jest
      .spyOn(service as never, "getProductWorkflowForApplication")
      .mockResolvedValue(FA_WORKFLOW as never);

    const readiness = await service.getSigningPackageReadiness("app-1");

    expect(readiness.issues.map((issue) => issue.code)).not.toContain("SIGNING_SEAL_APPLIER_MISSING");
  });

  it("flags a missing seal applier when the invoice offer has no applier", async () => {
    const service = createService({
      findApplicationContext: jest.fn().mockResolvedValue({
        id: "app-1",
        issuer_organization_id: "org-1",
        financing_structure: { structure_type: "invoice_only" },
        contract_id: "holder-1",
        contract: { id: "holder-1", offer_details: {} },
        invoices: [
          {
            id: "inv-1",
            status: InvoiceStatus.OFFER_SENT,
            offer_details: {
              offer_acceptance: {
                status: "APPROVED_FOR_SIGNING",
                authorized_parties: {
                  submitted_by_user_id: "user-1",
                  submitted_at: "2026-09-01T00:00:00.000Z",
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
                        },
                      ],
                    },
                  ],
                },
              },
            },
          },
        ],
      }),
    });
    jest
      .spyOn(service as never, "getProductWorkflowForApplication")
      .mockResolvedValue(FA_WORKFLOW as never);

    const readiness = await service.getSigningPackageReadiness("app-1");

    expect(readiness.issues.map((issue) => issue.code)).toContain("SIGNING_SEAL_APPLIER_MISSING");
  });

  it("flags an approved representative whose Person Email changed", async () => {
    loadPool.mockResolvedValue([
      {
        matchKey: "820508105871",
        name: "Ali Bin Abu",
        email: "new@co.my",
        icNumber: "820508105871",
      },
    ]);
    const service = createService({
      findApplicationContext: jest.fn().mockResolvedValue({
        id: "app-1",
        issuer_organization_id: "org-1",
        financing_structure: { structure_type: "invoice_only" },
        contract_id: "holder-1",
        contract: { id: "holder-1", offer_details: {} },
        invoices: [
          {
            id: "inv-1",
            status: InvoiceStatus.OFFER_SENT,
            offer_details: invoiceOfferWithSealApplier,
          },
        ],
      }),
    });
    jest
      .spyOn(service as never, "getProductWorkflowForApplication")
      .mockResolvedValue(FA_WORKFLOW as never);

    const readiness = await service.getSigningPackageReadiness("app-1");

    expect(readiness.issues.map((issue) => issue.code)).toContain(
      "AUTHORIZED_REPRESENTATIVE_PROFILE_CHANGED"
    );
  });
});
