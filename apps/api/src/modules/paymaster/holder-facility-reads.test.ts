const mockPaymasterCount = jest.fn();
const mockPaymasterFindMany = jest.fn();
const mockPaymasterFindUnique = jest.fn();
const mockUserFindUnique = jest.fn();
const mockTransaction = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockTransaction(...args),
    paymaster: {
      count: (...args: unknown[]) => mockPaymasterCount(...args),
      findMany: (...args: unknown[]) => mockPaymasterFindMany(...args),
      findUnique: (...args: unknown[]) => mockPaymasterFindUnique(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
  },
}));

import { realFacilityContractWhere } from "../../lib/standalone-holder-contract";
import { getAdminPaymasterDetail, listAdminPaymasters } from "./service";

const now = new Date("2026-03-01T00:00:00.000Z");

function applicationRow(id: string, structureType: string) {
  return {
    id,
    display_reference: id.toUpperCase(),
    status: "SUBMITTED",
    submitted_at: now,
    updated_at: now,
    financing_type: { product_id: "prod-1" },
    financing_structure: { structure_type: structureType },
  };
}

describe("paymaster holder facility exclusion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction.mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops));
    mockPaymasterCount.mockResolvedValue(1);
    mockPaymasterFindMany.mockResolvedValue([]);
  });

  it("counts only real facilities on the admin list", async () => {
    mockPaymasterFindMany.mockResolvedValue([
      {
        id: "pm-1",
        legal_name: "Paymaster Sdn Bhd",
        registration_number: "123456789",
        registration_country: "MY",
        entity_type: "SDN_BHD",
        verification_status: "VERIFIED",
        verified_at: now,
        verified_by_user_id: null,
        created_at: now,
        updated_at: now,
        _count: { issuer_links: 1, notes: 0, contracts: 2, assignment_notices: 0 },
        issuer_links: [],
      },
    ]);

    const result = await listAdminPaymasters({ page: 1, pageSize: 20 });
    expect(result.items[0]?.linkedFacilityCount).toBe(2);

    const findManyArg = mockPaymasterFindMany.mock.calls[0]?.[0] as {
      include: { _count: { select: { contracts: { where: unknown } } } };
    };
    expect(findManyArg.include._count.select.contracts).toEqual({
      where: realFacilityContractWhere(),
    });
  });

  it("excludes holder contracts from financings but keeps invoice-only applications", async () => {
    mockPaymasterFindUnique.mockResolvedValue({
      id: "pm-1",
      legal_name: "Paymaster Sdn Bhd",
      registration_number: "123456789",
      registration_country: "MY",
      entity_type: "SDN_BHD",
      verification_status: "VERIFIED",
      verified_at: now,
      verified_by_user_id: null,
      source: "admin",
      created_at: now,
      updated_at: now,
      issuer_links: [],
      assignment_notices: [],
      notes: [
        {
          id: "note-1",
          note_reference: "NT-1",
          issuer_organization_id: "org-1",
          status: "DRAFT",
          updated_at: now,
          target_amount: { toString: () => "1000" },
        },
      ],
      contracts: [
        {
          id: "holder-1",
          display_reference: "CTR-H",
          issuer_organization_id: "org-1",
          status: "SUBMITTED",
          updated_at: now,
          customer_details: { name: "Acme" },
          issuer_organization: { name: "Issuer" },
          originating_application: null,
          applications: [applicationRow("app-invoice", "invoice_only")],
        },
        {
          id: "facility-1",
          display_reference: "CTR-F",
          issuer_organization_id: "org-1",
          status: "APPROVED",
          updated_at: now,
          customer_details: { name: "Acme" },
          issuer_organization: { name: "Issuer" },
          originating_application: null,
          applications: [applicationRow("app-facility", "new_contract")],
        },
      ],
    });

    const detail = await getAdminPaymasterDetail("pm-1");
    expect(detail.applications.map((row) => row.id).sort()).toEqual(["app-facility", "app-invoice"]);
    expect(detail.financings.map((row) => row.contractId)).toEqual(["facility-1", null]);
    expect(detail.financings.map((row) => row.noteId)).toEqual([null, "note-1"]);
  });
});
