const mockPartyFindFirst = jest.fn();
const mockPartyUpdate = jest.fn();
const mockSupplementFindFirst = jest.fn();
const mockSupplementCreate = jest.fn();
const mockSupplementUpdate = jest.fn();
const mockIssuerFindUnique = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    organizationPartyProfile: {
      findFirst: (...args: unknown[]) => mockPartyFindFirst(...args),
      update: (...args: unknown[]) => mockPartyUpdate(...args),
    },
    ctosPartySupplement: {
      findFirst: (...args: unknown[]) => mockSupplementFindFirst(...args),
      create: (...args: unknown[]) => mockSupplementCreate(...args),
      update: (...args: unknown[]) => mockSupplementUpdate(...args),
    },
    issuerOrganization: {
      findUnique: (...args: unknown[]) => mockIssuerFindUnique(...args),
    },
    investorOrganization: {
      findUnique: jest.fn(),
    },
  },
}));

import { writeOrganizationPartyEmail } from "./person-email";

const generatedKey = "user:550e8400-e29b-41d4-a716-446655440000";

describe("writeOrganizationPartyEmail generated-key lookup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIssuerFindUnique.mockResolvedValue({ director_kyc_status: null });
    mockPartyFindFirst.mockResolvedValue({
      id: "party-1",
      party_key: generatedKey,
      email: null,
    });
    mockPartyUpdate.mockImplementation(async ({ data }: { data: { email: string | null } }) => ({
      email: data.email,
      party_key: generatedKey,
    }));
    mockSupplementFindFirst.mockResolvedValue(null);
    mockSupplementCreate.mockResolvedValue({ id: "sup-1" });
  });

  it("looks up OPP and supplement by the exact user:{uuid} party_key", async () => {
    const result = await writeOrganizationPartyEmail({
      portal: "issuer",
      organizationId: "org-1",
      partyKey: generatedKey,
      email: "preid@example.com",
    });
    expect(result.email).toBe("preid@example.com");
    expect(mockPartyFindFirst).toHaveBeenCalledWith({
      where: {
        issuer_organization_id: "org-1",
        investor_organization_id: null,
        party_key: generatedKey,
      },
    });
    expect(mockSupplementFindFirst).toHaveBeenCalledWith({
      where: { issuer_organization_id: "org-1", party_key: generatedKey },
    });
    expect(mockSupplementCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ party_key: generatedKey }),
      })
    );
  });
});
