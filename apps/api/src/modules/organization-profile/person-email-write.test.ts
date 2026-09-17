const mockPartyFindFirst = jest.fn();
const mockPartyUpdate = jest.fn();
const mockSupplementFindFirst = jest.fn();
const mockSupplementCreate = jest.fn();
const mockSupplementUpdate = jest.fn();
const mockIssuerFindUnique = jest.fn();
const mockUserUpdate = jest.fn();
const mockTransaction = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockTransaction(...args),
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
    user: {
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
  },
}));

import { writeOrganizationPartyEmail } from "./person-email";

const generatedKey = "user:550e8400-e29b-41d4-a716-446655440000";
const legacyKey = "900101-14-5678";

const tx = {
  organizationPartyProfile: { update: (...args: unknown[]) => mockPartyUpdate(...args) },
  ctosPartySupplement: {
    create: (...args: unknown[]) => mockSupplementCreate(...args),
    update: (...args: unknown[]) => mockSupplementUpdate(...args),
  },
  user: { update: (...args: unknown[]) => mockUserUpdate(...args) },
};

describe("writeOrganizationPartyEmail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction.mockImplementation(async (fn: (client: typeof tx) => unknown) => fn(tx));
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
    expect(mockTransaction).toHaveBeenCalled();
  });

  it("persists an approved post-KYC Person Email without resetting KYC/AML or User email", async () => {
    mockPartyFindFirst.mockResolvedValue({
      id: "party-1",
      party_key: generatedKey,
      email: "old@acme.test",
    });
    mockSupplementFindFirst.mockResolvedValue({
      id: "sup-1",
      onboarding_json: {
        email: "old@acme.test",
        status: "APPROVED",
        requestId: "LD-APPROVED",
        screening: { status: "CLEAR", requestId: "aml-1" },
      },
    });

    const result = await writeOrganizationPartyEmail({
      portal: "issuer",
      organizationId: "org-1",
      partyKey: generatedKey,
      email: "new@acme.test",
    });

    expect(result.email).toBe("new@acme.test");
    expect(mockPartyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { email: "new@acme.test" } })
    );
    const snapshot = mockSupplementUpdate.mock.calls[0]?.[0].data.onboarding_json as {
      email?: string;
      status?: string;
      requestId?: string;
      screening?: { status?: string; requestId?: string } | null;
    };
    expect(snapshot.email).toBe("new@acme.test");
    expect(snapshot.status).toBe("APPROVED");
    expect(snapshot.requestId).toBe("LD-APPROVED");
    expect(snapshot.screening?.status).toBe("CLEAR");
    expect(snapshot.screening?.requestId).toBe("aml-1");
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("clears the supplement snapshot when the master Person Email is cleared", async () => {
    mockPartyFindFirst.mockResolvedValue({
      id: "party-1",
      party_key: generatedKey,
      email: "old@acme.test",
    });
    mockSupplementFindFirst.mockResolvedValue({
      id: "sup-1",
      onboarding_json: {
        email: "old@acme.test",
        status: "APPROVED",
        requestId: "LD-APPROVED",
        screening: null,
      },
    });

    const result = await writeOrganizationPartyEmail({
      portal: "issuer",
      organizationId: "org-1",
      partyKey: generatedKey,
      email: null,
    });

    expect(result.email).toBeNull();
    expect(mockPartyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { email: null } })
    );
    const snapshot = mockSupplementUpdate.mock.calls[0]?.[0].data.onboarding_json as Record<
      string,
      unknown
    >;
    expect(snapshot).not.toHaveProperty("email");
    expect(snapshot.status).toBe("APPROVED");
    expect(snapshot.requestId).toBe("LD-APPROVED");
  });

  it("clears a fallback snapshot when the master Person Email is already empty", async () => {
    mockSupplementFindFirst.mockResolvedValue({
      id: "sup-1",
      onboarding_json: {
        email: "legacy@acme.test",
        status: "APPROVED",
        requestId: "LD-APPROVED",
        screening: null,
      },
    });

    const result = await writeOrganizationPartyEmail({
      portal: "issuer",
      organizationId: "org-1",
      partyKey: generatedKey,
      email: null,
    });

    expect(result.email).toBeNull();
    expect(mockPartyUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { email: null } })
    );
    const snapshot = mockSupplementUpdate.mock.calls[0]?.[0].data.onboarding_json as Record<
      string,
      unknown
    >;
    expect(snapshot).not.toHaveProperty("email");
    expect(snapshot.status).toBe("APPROVED");
    expect(snapshot.requestId).toBe("LD-APPROVED");
  });

  it("rejects a write when legacy KYC is awaiting approval without a supplement", async () => {
    mockPartyFindFirst.mockResolvedValue({
      id: "party-1",
      party_key: legacyKey,
      email: "old@acme.test",
    });
    mockIssuerFindUnique.mockResolvedValue({
      director_kyc_status: {
        directors: [
          {
            governmentIdNumber: legacyKey,
            kycStatus: "WAIT_FOR_APPROVAL",
          },
        ],
      },
    });

    await expect(
      writeOrganizationPartyEmail({
        portal: "issuer",
        organizationId: "org-1",
        partyKey: legacyKey,
        email: "new@acme.test",
      })
    ).rejects.toMatchObject({
      code: "DIRECTOR_SHAREHOLDER_NOT_EDITABLE",
    });
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockPartyUpdate).not.toHaveBeenCalled();
  });

  it("does not write a partial master when the supplement snapshot fails", async () => {
    mockPartyFindFirst.mockResolvedValue({
      id: "party-1",
      party_key: generatedKey,
      email: "old@acme.test",
    });
    mockSupplementFindFirst.mockResolvedValue({
      id: "sup-1",
      onboarding_json: { email: "old@acme.test", status: "IN_PROGRESS", requestId: "LD-1" },
    });
    mockSupplementUpdate.mockRejectedValue(new Error("snapshot failed"));
    mockTransaction.mockImplementation(async (fn: (client: typeof tx) => unknown) => {
      try {
        return await fn(tx);
      } catch (error) {
        mockPartyUpdate.mockClear();
        throw error;
      }
    });

    await expect(
      writeOrganizationPartyEmail({
        portal: "issuer",
        organizationId: "org-1",
        partyKey: generatedKey,
        email: "new@acme.test",
      })
    ).rejects.toThrow("snapshot failed");
    expect(mockPartyUpdate).not.toHaveBeenCalled();
  });
});
